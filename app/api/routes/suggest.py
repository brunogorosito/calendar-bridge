from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...models import User
from ...services.suggest import suggest_slots
from ..deps import require_api_key

router = APIRouter(prefix="/suggest", tags=["suggest"], dependencies=[Depends(require_api_key)])


@router.get("/slots")
async def free_slots(
    start: datetime,
    end: datetime,
    duration: int = Query(60, ge=10, le=480, description="duración en minutos"),
    max_results: int = Query(10, ge=1, le=30),
    start_at_hour: int | None = Query(None, ge=0, le=23),
    end_at_hour: int | None = Query(None, ge=0, le=23),
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
    try:
        slots = await suggest_slots(
            db,
            user,
            start=start,
            end=end,
            duration_minutes=duration,
            max_results=max_results,
            start_at_hour=start_at_hour,
            end_at_hour=end_at_hour,
        )
    except ValueError as e:
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail=str(e))
    return {"slots": slots, "duration_minutes": duration}