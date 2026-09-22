from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...models import User
from ...services.stats import stats

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("")
async def get_stats(
    start: datetime,
    end: datetime,
    tz: str = "America/Argentina/Buenos_Aires",
    work_start: str = Query("09:00"),
    work_end: str = Query("18:00"),
    lunch_start: str = Query("13:00"),
    lunch_end: str = Query("14:00"),
    db: AsyncSession = Depends(get_db),
):
    user = User(
        timezone=tz,
        work_start=work_start,
        work_end=work_end,
        lunch_start=lunch_start,
        lunch_end=lunch_end,
    )
    return await stats(db, user, start=start, end=end)