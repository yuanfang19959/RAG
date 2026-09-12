from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from rag.db import check_database

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str
    version: str
    db: str
    db_detail: str | None = Field(
        default=None,
        description="仅在 db=error 时返回简要原因",
    )


@router.get("/health", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    settings = request.app.state.settings
    engine = getattr(request.app.state, "engine", None)
    db_status, db_detail = await check_database(engine)

    return HealthResponse(
        status="ok",
        service=settings.app_name,
        version=settings.app_version,
        db=db_status,
        db_detail=db_detail if db_status == "error" else None,
    )
