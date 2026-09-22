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

    is_workday = day.weekday() < 5  # lun-vie

    ws = _parse_time(user.work_start, day)
    we = _parse_time(user.work_end, day)
    ls = _parse_time(user.lunch_start or "13:00", day)
    le = _parse_time(user.lunch_end or "14:00", day)

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
                summary=ev.summary,
                description=clean_description(ev.description),
                location=ev.location,
                online_meeting_url=ev.online_meeting_url,
            )
        )
    # almuerzo como bloque propio (solo días laborables)
    if is_workday:
        blocks.append(
            TimeBlock(
                start=ls,
                end=le,
                busy=True,
                source="lunch",
                summary="Almuerzo",
                description="",
            )
        )
    blocks.sort(key=lambda b: b.start)

    if not is_workday:
        return DayView(
            date=day.date().isoformat(),
            work_start=user.work_start,
            work_end=user.work_end,
            lunch_start=user.lunch_start or "13:00",
            lunch_end=user.lunch_end or "14:00",
            is_workday=False,
            blocks=[],
            busy_minutes=0,
            free_minutes=0,
        )

    total = max(0, int((we - ws).total_seconds() // 60))
    lunch_minutes = max(0, int((le - ls).total_seconds() // 60))

    # solo contar minutos ocupados dentro de la jornada laboral (incluye almuerzo)
    busy_minutes = 0
    for b in blocks:
        if not b.busy:
            continue
        s = max(b.start, ws)
        e = min(b.end, we)
        if s < e:
            busy_minutes += int((e - s).total_seconds() // 60)

    # el tiempo libre se calcula sobre la jornada menos el almuerzo (8h efectivas)
    free_minutes = max(0, total - lunch_minutes - busy_minutes)

    return DayView(
        date=day.date().isoformat(),
        work_start=user.work_start,
        work_end=user.work_end,
        lunch_start=user.lunch_start or "13:00",
        lunch_end=user.lunch_end or "14:00",
        is_workday=True,
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


TEAMS_NOISE = (
    "reunión de microsoft teams",
    "microsoft teams meeting",
    "microsoft teams ",
    "unirse:",
    "join:",
    "unirse",
    "join",
    "¿necesita ayuda?",
    "need help?",
    "privacy and security",
    "privacidad y seguridad",
    "learn more",
    "más información",
    "company logo",
    "logo",
    "[company logo]",
    "___",
    "____",
    "___ _",
    "…",
    # sensitive / organizer-only info
    "passcode:",
    "código de acceso:",
    "for organizers:",
    "para organizadores:",
    "meeting id:",
    "id. de reunión:",
    "id de reunión:",
)


def clean_description(desc: str) -> str:
    """Remove Microsoft Teams / Exchange boilerplate from event descriptions."""
    if not desc:
        return ""
    lines = []
    for raw in desc.splitlines():
        line = raw.strip()
        low = line.lower()
        if not line:
            continue
        if low.startswith(TEAMS_NOISE):
            continue
        if line.startswith("http") or line.startswith("[http"):
            continue
        lines.append(line)
    text = "\n".join(lines).strip()
    # collapse duplicate separators
    while "___" in text:
        text = text.replace("___", "—")
    return text[:800]


def week_start(day: datetime) -> datetime:
    return day - timedelta(days=day.weekday())


def month_start(day: datetime) -> datetime:
    return day.replace(day=1, hour=0, minute=0, second=0, microsecond=0)