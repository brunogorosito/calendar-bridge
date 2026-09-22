from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from ..models import User
from .availability import _account_map, _events_in_range, _parse_time
from .holidays import holiday_on


async def suggest_slots(
    db: AsyncSession,
    user: User,
    *,
    start: datetime,
    end: datetime,
    duration_minutes: int = 60,
    max_results: int = 10,
    start_at_hour: int | None = None,
    end_at_hour: int | None = None,
) -> list[dict]:
    """Find free slots of `duration_minutes` within [start, end).

    Respects working hours, lunch break, weekends and AR national holidays.
    Returns slots sorted by date/time, each with account/availability info.
    """
    if duration_minutes <= 0:
        raise ValueError("duration_minutes must be positive")
    if end <= start:
        raise ValueError("end must be after start")

    ws_str = user.work_start or "09:00"
    we_str = user.work_end or "18:00"
    ls_str = user.lunch_start or "13:00"
    le_str = user.lunch_end or "14:00"

    # day window for scanning: from the start day to the end day
    scan_start = start.replace(hour=0, minute=0, second=0, microsecond=0)
    scan_end = end.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)

    events = await _events_in_range(db, user.id, scan_start, scan_end)
    if events:
        account_map = await _account_map(db, {ev.user_id for ev in events})
    else:
        account_map = {}

    # build busy intervals per day
    busy_by_day: dict[str, list[tuple[datetime, datetime]]] = {}
    for ev in events:
        if not ev.busy:
            continue
        d = ev.start.strftime("%Y-%m-%d")
        busy_by_day.setdefault(d, []).append((ev.start, ev.end))

    slots: list[dict] = []
    day = scan_start
    while day < scan_end:
        d_str = day.strftime("%Y-%m-%d")
        # weekends and holidays are not workdays
        is_workday = day.weekday() < 5
        holiday_name = holiday_on(d_str)
        if holiday_name:
            is_workday = False
        if is_workday:
            work_start = _parse_time(ws_str, day)
            work_end = _parse_time(we_str, day)
            lunch_start = _parse_time(ls_str, day)
            lunch_end = _parse_time(le_str, day)

            # respect explicit query windows (hour-level)
            if start_at_hour is not None:
                work_start = max(work_start, work_start.replace(hour=start_at_hour))
            if end_at_hour is not None:
                work_end = min(work_end, work_end.replace(hour=end_at_hour))

            # clamp to requested overall range
            lo = max(work_start, start)
            hi = min(work_end, end)
            if lo >= hi:
                day += timedelta(days=1)
                continue

            busy = sorted(
                b for b in busy_by_day.get(d_str, []) if b[1] > lo and b[0] < hi
            )

            # merge busy with lunch as a blocked zone
            blocked: list[tuple[datetime, datetime]] = [(lunch_start, lunch_end)]
            blocked.extend(busy)
            blocked = [b for b in blocked if b[1] > lo and b[0] < hi]
            blocked.sort()

            cursor = lo
            for bs, be in blocked:
                bs = max(bs, lo)
                be = min(be, hi)
                if bs > cursor:
                    _emit_slots(slots, cursor, bs, duration_minutes, max_results)
                    if len(slots) >= max_results:
                        break
                cursor = max(cursor, be)
            if len(slots) < max_results and hi > cursor:
                _emit_slots(slots, cursor, hi, duration_minutes, max_results)

            if len(slots) >= max_results:
                break
        day += timedelta(days=1)

    return slots[:max_results]


def _emit_slots(slots, free_start, free_end, duration_minutes, max_results):
        """Emit candidate slots every 30 min within [free_start, free_end)."""
        step = timedelta(minutes=30)
        cursor = free_start
        while cursor + timedelta(minutes=duration_minutes) <= free_end:
            slots.append(
                {
                    "start": cursor,
                    "end": cursor + timedelta(minutes=duration_minutes),
                    "free_from": free_start,
                    "free_to": free_end,
                    "date": cursor.strftime("%Y-%m-%d"),
                    "holiday": None,
                }
            )
            if len(slots) >= max_results:
                return
            cursor += step