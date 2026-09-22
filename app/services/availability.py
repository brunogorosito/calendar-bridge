from __future__ import annotations

from datetime import datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import CalendarEvent, User
from ..schemas import DayView, MonthView, TimeBlock, WeekView


async def _events_in_range(
    db: AsyncSession, user_id: int | None, start: datetime, end: datetime
) -> list[CalendarEvent]:
    query = (
        select(CalendarEvent)
        .where(
            CalendarEvent.start < end,
            CalendarEvent.end > start,
        )
        .order_by(CalendarEvent.start)
    )
    if user_id is not None:
        query = query.where(CalendarEvent.user_id == user_id)
    result = await db.execute(query)
    return result.scalars().all()


async def get_day_view(
    db: AsyncSession, user: User, day: datetime
) -> DayView:
    day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)
    events = await _events_in_range(db, user.id, day_start, day_end)

    blocks: list[TimeBlock] = []
    for ev in events:
        s = max(ev.start, day_start)
        e = min(ev.end, day_end)
        if s >= e:
            continue
        blocks.append(
            TimeBlock(
                start=s,
                end=e,
                busy=ev.busy,
                source=ev.provider,
            )
        )
    blocks.sort(key=lambda b: b.start)

    busy_minutes = sum(int((b.end - b.start).total_seconds() // 60) for b in blocks if b.busy)

    ws = _parse_time(user.work_start, day)
    we = _parse_time(user.work_end, day)
    total = max(0, int((we - ws).total_seconds() // 60))
    free_minutes = max(0, total - busy_minutes)

    return DayView(
        date=day.date().isoformat(),
        work_start=user.work_start,
        work_end=user.work_end,
        blocks=blocks,
        busy_minutes=busy_minutes,
        free_minutes=free_minutes,
    )


async def get_week_view(db: AsyncSession, user: User, monday: datetime) -> WeekView:
    days = []
    for i in range(7):
        days.append(await get_day_view(db, user, monday + timedelta(days=i)))
    return WeekView(days=days)


async def get_month_view(db: AsyncSession, user: User, month_start: datetime) -> MonthView:
    # calendar weeks starting Monday, covering the month
    first_monday = month_start - timedelta(days=month_start.weekday())
    weeks: list[list[DayView]] = []
    current = first_monday
    month_end = (month_start.replace(day=28) + timedelta(days=7)).replace(day=1)
    while current < month_end:
        week = await get_week_view(db, user, current)
        weeks.append(week.days)
        current += timedelta(days=7)
    return MonthView(weeks=weeks)


def _parse_time(value: str, day: datetime) -> datetime:
    h, m = (int(x) for x in value.split(":"))
    return day.replace(hour=h, minute=m, second=0, microsecond=0)


def week_start(day: datetime) -> datetime:
    return day - timedelta(days=day.weekday())


def month_start(day: datetime) -> datetime:
    return day.replace(day=1, hour=0, minute=0, second=0, microsecond=0)