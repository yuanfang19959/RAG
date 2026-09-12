import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


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


class Citation(BaseModel):
    """一条引用：答案里的 [n] 对应这里的第 n 项。"""

    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_title: str
    chunk_index: int
    content: str
    score: float = Field(description="余弦相似度，越大越相关")


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    top_k: int | None = Field(default=None, ge=1, le=20)


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]
    model: str


class ChatStreamRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    conversation_id: uuid.UUID | None = Field(
        default=None, description="不传则新建会话"
    )
    top_k: int | None = Field(default=None, ge=1, le=20)
    client: str = Field(default="web", max_length=32)


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: str
    content: str
    citations: list[Citation] | None
    created_at: datetime


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    client: str
    created_at: datetime
    updated_at: datetime


class ConversationDetail(ConversationOut):
    messages: list[MessageOut]
