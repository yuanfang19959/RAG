import json
from collections.abc import AsyncIterator
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from rag.db import get_session
from rag.models import Conversation, Message
from rag.schemas import (
    ChatRequest,
    ChatResponse,
    ChatStreamRequest,
    Citation,
)
from rag.services.chat import EMPTY_KB_ANSWER, answer_question, retrieve, stream_answer
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


def sse(event: str, data: Any) -> str:
    """SSE 一帧：event 行 + data 行 + 空行结尾，缺一个前端就收不到。"""
    payload = json.dumps(data, ensure_ascii=False)
    return f"event: {event}\ndata: {payload}\n\n"


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
    """检索 + 生成：返回答案和它引用的原文片段（非流式）。"""
    settings = request.app.state.settings
    embeddings = _require_embeddings(request)
    llm = _require_llm(request)

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


@router.post("/chat/stream")
async def chat_stream(request: Request, payload: ChatStreamRequest) -> StreamingResponse:
    """SSE 流式问答。

    事件顺序：citations → 若干 token → done；出错则 error。
    依赖在响应开始前检查完，一旦开始流式就只能用 error 事件报错了。
    """
    settings = request.app.state.settings
    embeddings = _require_embeddings(request)
    llm = _require_llm(request)
    session_factory = getattr(request.app.state, "session_factory", None)
    if session_factory is None:
        raise HTTPException(status_code=503, detail="数据库未配置")

    async def event_stream() -> AsyncIterator[str]:
        # 流式响应的生命周期比请求依赖长，所以这里自己开会话
        async with session_factory() as session:
            try:
                conversation = await _resolve_conversation(session, payload)
                history = list(conversation.messages)

                session.add(
                    Message(
                        conversation_id=conversation.id,
                        role="user",
                        content=payload.question,
                    )
                )
                await session.commit()

                hits = await retrieve(
                    session,
                    embeddings,
                    payload.question,
                    payload.top_k or settings.retrieval_top_k,
                )
                citations = to_citations(hits)
                yield sse(
                    "citations",
                    {
                        "conversation_id": str(conversation.id),
                        "citations": [c.model_dump(mode="json") for c in citations],
                    },
                )

                if not hits:
                    answer = EMPTY_KB_ANSWER
                    yield sse("token", {"text": answer})
                else:
                    parts: list[str] = []
                    async for text in stream_answer(
                        llm, payload.question, hits, history
                    ):
                        parts.append(text)
                        yield sse("token", {"text": text})
                    answer = "".join(parts).strip()

                assistant = Message(
                    conversation_id=conversation.id,
                    role="assistant",
                    content=answer,
                    citations=[c.model_dump(mode="json") for c in citations],
                )
                session.add(assistant)
                await session.commit()

                yield sse(
                    "done",
                    {
                        "conversation_id": str(conversation.id),
                        "message_id": str(assistant.id),
                        "model": settings.llm_model,
                    },
                )
            except Exception as exc:  # 已经开始流式，只能用事件把错误送出去
                await session.rollback()
                yield sse("error", {"detail": f"生成回答失败：{exc}"})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            # nginx 反代时别把流攒成一坨
            "X-Accel-Buffering": "no",
        },
    )


async def _resolve_conversation(
    session: AsyncSession, payload: ChatStreamRequest
) -> Conversation:
    """带 conversation_id 就续聊，否则用问题前 50 字当标题新建一个。"""
    if payload.conversation_id is not None:
        statement = (
            select(Conversation)
            .where(Conversation.id == payload.conversation_id)
            .limit(1)
        )
        conversation = (await session.execute(statement)).scalar_one_or_none()
        if conversation is None:
            raise ValueError("会话不存在")
        await session.refresh(conversation, ["messages"])
        return conversation

    conversation = Conversation(
        title=payload.question[:50],
        client=payload.client,
    )
    session.add(conversation)
    await session.commit()
    await session.refresh(conversation, ["messages"])
    return conversation


def _require_embeddings(request: Request):
    embeddings = getattr(request.app.state, "embeddings", None)
    if embeddings is None:
        raise HTTPException(
            status_code=503, detail="未配置 embedding 服务（SILICONFLOW_*）"
        )
    return embeddings


def _require_llm(request: Request):
    llm = getattr(request.app.state, "llm", None)
    if llm is None:
        raise HTTPException(status_code=503, detail="未配置生成模型（DEEPSEEK_*）")
    return llm
