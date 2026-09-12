from collections.abc import AsyncIterator

from fastapi import HTTPException, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from rag.config import Settings


def create_engine(settings: Settings) -> AsyncEngine | None:
    if not settings.database_url:
        return None
    return create_async_engine(settings.database_url, pool_pre_ping=True)


def create_session_factory(
    engine: AsyncEngine | None,
) -> async_sessionmaker[AsyncSession] | None:
    if engine is None:
        return None
    return async_sessionmaker(engine, expire_on_commit=False)


async def check_database(engine: AsyncEngine | None) -> tuple[str, str | None]:
    """Return (status, detail). status: ok | error | not_configured."""
    if engine is None:
        return "not_configured", None

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return "ok", None
    except Exception as exc:  # noqa: BLE001 — health 需要把原因回给调用方
        return "error", str(exc)


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    """依赖注入：每个请求拿一个数据库会话，用完自动关闭。"""
    factory = getattr(request.app.state, "session_factory", None)
    if factory is None:
        raise HTTPException(status_code=503, detail="数据库未配置")

    async with factory() as session:
        yield session
