from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from rag.config import Settings


def create_engine(settings: Settings) -> AsyncEngine | None:
    if not settings.database_url:
        return None
    return create_async_engine(settings.database_url, pool_pre_ping=True)


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
