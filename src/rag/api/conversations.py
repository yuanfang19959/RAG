import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from rag.db import get_session
from rag.models import Conversation
from rag.schemas import ConversationDetail, ConversationOut

router = APIRouter(prefix="/conversations", tags=["conversations"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.get("", response_model=list[ConversationOut])
async def list_conversations(
    session: SessionDep,
    limit: int = 20,
    offset: int = 0,
) -> list[Conversation]:
    result = await session.execute(
        select(Conversation)
        .order_by(Conversation.updated_at.desc())
        .limit(min(limit, 100))
        .offset(offset)
    )
    return list(result.scalars())


@router.get("/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    session: SessionDep, conversation_id: uuid.UUID
) -> Conversation:
    """带上全部消息，用来刷新页面后还原对话。"""
    result = await session.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(selectinload(Conversation.messages))
    )
    conversation = result.scalar_one_or_none()
    if conversation is None:
        raise HTTPException(status_code=404, detail="会话不存在")
    return conversation


@router.delete("/{conversation_id}", status_code=204)
async def delete_conversation(
    session: SessionDep, conversation_id: uuid.UUID
) -> None:
    conversation = await session.get(Conversation, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="会话不存在")
    await session.delete(conversation)
    await session.commit()
