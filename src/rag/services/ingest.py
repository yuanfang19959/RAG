from pathlib import Path

from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from rag.config import Settings
from rag.models import Chunk, Document

SUPPORTED_SUFFIXES = {".txt", ".md"}


class IngestError(Exception):
    """入库过程中的可预期错误，由接口层翻译成 HTTP 状态码。"""


def read_text(path: Path) -> str:
    if path.suffix.lower() not in SUPPORTED_SUFFIXES:
        raise IngestError(f"暂不支持的文件类型：{path.suffix}")
    if not path.exists():
        raise IngestError("文件不存在，可能已被删除")

    text = path.read_text(encoding="utf-8", errors="ignore").strip()
    if not text:
        raise IngestError("文件内容为空")
    return text


def split_text(text: str, settings: Settings) -> list[str]:
    """把长文本切成小块：chunk_overlap 让相邻块有重叠，避免把一句话切断。"""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
    )
    chunks = [c.strip() for c in splitter.split_text(text)]
    chunks = [c for c in chunks if c]
    if not chunks:
        raise IngestError("切块结果为空")
    return chunks


async def ingest_document(
    session: AsyncSession,
    document: Document,
    embeddings: OpenAIEmbeddings,
    settings: Settings,
) -> int:
    """读文件 → 切块 → 算向量 → 写库，返回块数量。

    重复调用是幂等的：会先删掉这篇文档的旧块再写新块。
    """
    text = read_text(Path(document.source_uri))
    contents = split_text(text, settings)

    # 网络调用放在事务外，避免长时间占着数据库连接
    vectors = await embeddings.aembed_documents(contents)
    if len(vectors) != len(contents):
        raise IngestError("向量数量与文本块数量不一致")

    await session.execute(delete(Chunk).where(Chunk.document_id == document.id))
    session.add_all(
        [
            Chunk(
                document_id=document.id,
                chunk_index=index,
                content=content,
                embedding=vector,
            )
            for index, (content, vector) in enumerate(zip(contents, vectors))
        ]
    )

    document.status = "ready"
    document.error = None
    document.chunk_count = len(contents)
    await session.commit()

    return len(contents)
