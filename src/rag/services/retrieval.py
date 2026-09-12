from dataclasses import dataclass

from langchain_openai import OpenAIEmbeddings
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from rag.models import Chunk, Document


@dataclass
class SearchHit:
    """一条检索命中：块本身 + 它属于哪篇文档 + 相似度。"""

    chunk: Chunk
    document: Document
    score: float


async def search(
    session: AsyncSession,
    embeddings: OpenAIEmbeddings,
    question: str,
    top_k: int,
) -> list[SearchHit]:
    """把问题向量化，按余弦距离取最接近的 top_k 个块。"""
    query_vector = await embeddings.aembed_query(question)

    # <=> 是 pgvector 的余弦距离：0 表示方向完全一致，越小越相关
    distance = Chunk.embedding.cosine_distance(query_vector).label("distance")
    statement = (
        select(Chunk, Document, distance)
        .join(Document, Chunk.document_id == Document.id)
        .where(Document.status == "ready")
        .order_by(distance)
        .limit(top_k)
    )

    rows = await session.execute(statement)
    return [
        SearchHit(chunk=chunk, document=document, score=1 - float(dist))
        for chunk, document, dist in rows.all()
    ]


async def has_indexed_content(session: AsyncSession) -> bool:
    """知识库里有没有可检索的内容，用来提前拦掉无意义的 LLM 调用。"""
    statement = (
        select(Chunk.id)
        .join(Document, Chunk.document_id == Document.id)
        .where(Document.status == "ready")
        .limit(1)
    )
    result = await session.execute(statement)
    return result.first() is not None
