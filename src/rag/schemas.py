import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DocumentOut(BaseModel):
    """文档的对外结构；from_attributes 让它能直接吃 ORM 对象。"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    source_type: str
    status: str
    error: str | None
    chunk_count: int
    created_at: datetime
    updated_at: datetime


class IngestResult(BaseModel):
    document_id: uuid.UUID
    status: str
    chunk_count: int
    embedding_model: str
