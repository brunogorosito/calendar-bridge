from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from ..models import User
from .availability import _account_map, _events_in_range, _parse_time
from .holidays import holiday_on


async def stats(
    db: AsyncSession,
    user: User,
    *,
    start: datetime,
    end: datetime,
) -> dict:
    """Compute meeting stats grouped by provider/account over [start, end).

    Returns total busy minutes, per-account breakdown, and days with data.
    """
    scan_start = start.replace(hour=0, minute=0, second=0, microsecond=0)
    scan_end = end.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    events = await _events_in_range(db, user.id, scan_start, scan_end)
    if events:
        account_map = await _account_map(db, {ev.user_id for ev in events})
    else:
        account_map = {}

    ws = _parse_time(user.work_start or "09:00", start)
    we = _parse_time(user.work_end or "18:00", start)
    work_day_minutes = max(0, int((we - ws).total_seconds() // 60)) - 60  # minus lunch

    by_account: dict[str, dict] = {}
    by_day: dict[str, int] = {}
    total_busy = 0
    total_meetings = 0

    for ev in events:
        if not ev.busy:
            continue
        # count only overlap with work hours
        s = max(ev.start, scan_start)
        e = min(ev.end, scan_end)
        if s >= e:
            continue
        minutes = int((e - s).total_seconds() // 60)
        email, client_name = account_map.get(ev.user_id, ("", None))
        key = email or ev.provider
        acc = by_account.setdefault(
            key,
            {"provider": ev.provider, "email": email, "client_name": client_name, "minutes": 0, "meetings": 0},
        )
        acc["minutes"] += minutes
        acc["meetings"] += 1
        by_day[s.strftime("%Y-%m-%d")] = by_day.get(s.strftime("%Y-%m-%d"), 0) + minutes
        total_busy += minutes
        total_meetings += 1

    # workable days (lun-vie, no holiday) in range
    workable_days = 0
    day = scan_start
    while day < scan_end:
        if day.weekday() < 5 and not holiday_on(day.strftime("%Y-%m-%d")):
            workable_days += 1
        day += timedelta(days=1)

    return {
        "total_meetings": total_meetings,
        "total_busy_minutes": total_busy,
        "total_work_minutes": workable_days * work_day_minutes,
        "workable_days": workable_days,
        "by_account": list(by_account.values()),
        "by_day": by_day,
    }