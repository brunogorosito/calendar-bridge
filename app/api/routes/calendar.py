from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...models import CalendarEvent, User
from ...schemas import DayView, MonthView, EventOut, WeekView
from ...services.availability import get_day_view, get_month_view, get_week_view, month_start, week_start

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/events", response_model=list[EventOut])
async def list_events(
    start: datetime,
    end: datetime,
    provider: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(CalendarEvent)
        .where(CalendarEvent.start < end, CalendarEvent.end > start)
        .order_by(CalendarEvent.start)
    )
    if provider:
        query = query.where(CalendarEvent.provider == provider)
    result = await db.execute(query)
    return [EventOut.model_validate(ev) for ev in result.scalars().all()]


@router.get("/day/{date}", response_model=DayView)
async def day_view(
    date: str,
    tz: str = "UTC",
    work_start: str = Query("09:00"),
    work_end: str = Query("18:00"),
    db: AsyncSession = Depends(get_db),
):
    day = datetime.fromisoformat(date)
    user = User(timezone=tz, work_start=work_start, work_end=work_end)
    return await get_day_view(db, user, day)


@router.get("/week/{date}", response_model=WeekView)
async def week_view(
    date: str,
    tz: str = "UTC",
    work_start: str = Query("09:00"),
    work_end: str = Query("18:00"),
    db: AsyncSession = Depends(get_db),
):
    day = datetime.fromisoformat(date)
    user = User(timezone=tz, work_start=work_start, work_end=work_end)
    return await get_week_view(db, user, week_start(day))


@router.get("/month/{date}", response_model=MonthView)
async def month_view(
    date: str,
    tz: str = "UTC",
    work_start: str = Query("09:00"),
    work_end: str = Query("18:00"),
    db: AsyncSession = Depends(get_db),
):
    day = datetime.fromisoformat(date)
    user = User(timezone=tz, work_start=work_start, work_end=work_end)
    return await get_month_view(db, user, month_start(day))