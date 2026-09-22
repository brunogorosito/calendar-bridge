from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import EmailMessage, User
from ..schemas import EmailOut


async def list_unified_inbox(
    db: AsyncSession,
    user: User,
    *,
    limit: int = 50,
    unread_only: bool = False,
    search: str | None = None,
) -> list[EmailOut]:
    query = select(EmailMessage)
    if user.id is not None:
        query = query.where(EmailMessage.user_id == user.id)
    if unread_only:
        query = query.where(EmailMessage.is_read == False)  # noqa: E712
    if search:
        like = f"%{search}%"
        query = query.where(
            (EmailMessage.subject.ilike(like)) | (EmailMessage.from_email.ilike(like))
        )
    query = query.order_by(EmailMessage.received_at.desc()).limit(limit)
    result = await db.execute(query)
    return [EmailOut.model_validate(em) for em in result.scalars().all()]