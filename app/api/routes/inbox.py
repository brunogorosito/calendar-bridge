from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...models import User
from ...schemas import EmailOut
from ...services.inbox import list_unified_inbox
from ..deps import require_api_key

router = APIRouter(prefix="/inbox", tags=["inbox"], dependencies=[Depends(require_api_key)])


@router.get("", response_model=list[EmailOut])
async def unified_inbox(
    limit: int = Query(50, ge=1, le=100),
    unread_only: bool = False,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    user = User(email="bridge@local")  # single-user personal backend
    return await list_unified_inbox(
        db, user, limit=limit, unread_only=unread_only, search=search
    )