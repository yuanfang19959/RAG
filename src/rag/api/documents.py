import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from rag.db import get_session
from rag.models import Document
from rag.schemas import DocumentOut, IngestResult
from rag.services.ingest import SUPPORTED_SUFFIXES, IngestError, ingest_document

router = APIRouter(prefix="/documents", tags=["documents"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.post("", response_model=DocumentOut, status_code=201)
async def upload_document(
    request: Request,
    session: SessionDep,
    file: Annotated[UploadFile, File(description="目前支持 .txt / .md")],
) -> Document:
    """接收上传文件，落盘并登记一条 pending 文档（还没算向量）。"""
    settings = request.app.state.settings
    filename = file.filename or "untitled.txt"
    suffix = Path(filename).suffix.lower()

    if suffix not in SUPPORTED_SUFFIXES:
        raise HTTPException(
            status_code=400,
            detail=f"暂不支持 {suffix or '无后缀'}，当前支持："
            + "、".join(sorted(SUPPORTED_SUFFIXES)),
        )

    content = await file.read()
    if not content.strip():
        raise HTTPException(status_code=400, detail="文件内容为空")

    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    stored_path = upload_dir / f"{uuid.uuid4()}{suffix}"
    stored_path.write_bytes(content)

    document = Document(
        title=filename,
        source_type="upload",
        source_uri=str(stored_path),
        status="pending",
    )
    session.add(document)
    await session.commit()
    await session.refresh(document)
    return document


@router.post("/{document_id}/ingest", response_model=IngestResult)
async def ingest(
    request: Request,
    session: SessionDep,
    document_id: uuid.UUID,
) -> IngestResult:
    """切块 + 向量化。重复调用会覆盖旧块，结果一致。"""
    settings = request.app.state.settings
    embeddings = getattr(request.app.state, "embeddings", None)
    if embeddings is None:
        raise HTTPException(
            status_code=503, detail="未配置 embedding 服务（SILICONFLOW_*）"
        )

    document = await session.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="文档不存在")

    try:
        chunk_count = await ingest_document(
            session, document, embeddings, settings
        )
    except IngestError as exc:
        await _mark_failed(session, document, str(exc))
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # 多半是 embedding 服务报错或网络问题
        await _mark_failed(session, document, str(exc))
        raise HTTPException(
            status_code=502, detail=f"向量化失败：{exc}"
        ) from exc

    return IngestResult(
        document_id=document.id,
        status=document.status,
        chunk_count=chunk_count,
        embedding_model=settings.embedding_model,
    )


@router.get("", response_model=list[DocumentOut])
async def list_documents(
    session: SessionDep,
    limit: int = 20,
    offset: int = 0,
) -> list[Document]:
    result = await session.execute(
        select(Document)
        .order_by(Document.created_at.desc())
        .limit(min(limit, 100))
        .offset(offset)
    )
    return list(result.scalars())


@router.get("/{document_id}", response_model=DocumentOut)
async def get_document(session: SessionDep, document_id: uuid.UUID) -> Document:
    document = await session.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="文档不存在")
    return document


async def _mark_failed(
    session: AsyncSession, document: Document, reason: str
) -> None:
    await session.rollback()
    document.status = "failed"
    document.error = reason[:500]
    session.add(document)
    await session.commit()
