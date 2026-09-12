from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from rag.db import get_session
from rag.schemas import ChatRequest, ChatResponse, Citation
from rag.services.chat import answer_question
from rag.services.retrieval import SearchHit, search

router = APIRouter(tags=["chat"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


def to_citations(hits: list[SearchHit]) -> list[Citation]:
    return [
        Citation(
            chunk_id=hit.chunk.id,
            document_id=hit.document.id,
            document_title=hit.document.title,
            chunk_index=hit.chunk.chunk_index,
            content=hit.chunk.content,
            score=round(hit.score, 4),
        )
        for hit in hits
    ]


@router.get("/search", response_model=list[Citation])
async def search_chunks(
    request: Request,
    session: SessionDep,
    q: Annotated[str, Query(min_length=1, max_length=2000, description="查询内容")],
    top_k: Annotated[int | None, Query(ge=1, le=20)] = None,
) -> list[Citation]:
    """只做向量检索，不调用大模型。用来单独验证检索质量。"""
    settings = request.app.state.settings
    embeddings = _require_embeddings(request)

    hits = await search(session, embeddings, q, top_k or settings.retrieval_top_k)
    return to_citations(hits)


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: Request,
    session: SessionDep,
    payload: ChatRequest,
) -> ChatResponse:
    """检索 + 生成：返回答案和它引用的原文片段。"""
    settings = request.app.state.settings
    embeddings = _require_embeddings(request)
    llm = getattr(request.app.state, "llm", None)
    if llm is None:
        raise HTTPException(
            status_code=503, detail="未配置生成模型（DEEPSEEK_*）"
        )

    try:
        answer, hits = await answer_question(
            session,
            embeddings,
            llm,
            payload.question,
            payload.top_k or settings.retrieval_top_k,
        )
    except Exception as exc:  # 多半是模型服务报错或超时
        raise HTTPException(
            status_code=502, detail=f"生成回答失败：{exc}"
        ) from exc

    return ChatResponse(
        answer=answer,
        citations=to_citations(hits),
        model=settings.llm_model,
    )


def _require_embeddings(request: Request):
    embeddings = getattr(request.app.state, "embeddings", None)
    if embeddings is None:
        raise HTTPException(
            status_code=503, detail="未配置 embedding 服务（SILICONFLOW_*）"
        )
    return embeddings
