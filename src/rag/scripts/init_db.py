"""建表脚本：uv run rag-init-db

对应 PageIo 里的 `npm run init-db`。可重复执行，已存在的对象会跳过。
"""

import asyncio

from sqlalchemy import text

from rag.config import get_settings
from rag.db import create_engine
from rag.models import EMBEDDING_DIM, Base


async def init() -> None:
    settings = get_settings()
    engine = create_engine(settings)
    if engine is None:
        raise SystemExit("未配置 DATABASE_URL，请检查 .env")

    async with engine.begin() as conn:
        # 向量类型由 pgvector 扩展提供，必须先启用再建表
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
        # 余弦相似度索引，供 P2 检索使用
        await conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_chunks_embedding "
                "ON chunks USING hnsw (embedding vector_cosine_ops)"
            )
        )

    await engine.dispose()
    print(f"✅ 建表完成（embedding 维度 {EMBEDDING_DIM}）：documents, chunks")


def main() -> None:
    asyncio.run(init())
