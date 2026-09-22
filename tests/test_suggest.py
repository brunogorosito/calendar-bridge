import pytest
from datetime import datetime, timedelta

from app.models import User
from app.services.suggest import suggest_slots


class FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return self

    def all(self):
        return self._rows

    def __iter__(self):
        return iter(self._rows)


class FakeDB:
    """Minimal AsyncSession stub returning scripted events."""

    def __init__(self, events):
        self._events = events
        self.executions = 0

    async def execute(self, stmt):
        self.executions += 1
        # first call is _events_in_range -> events; second is _account_map
        if self.executions == 1:
            return FakeResult(self._events)
        return FakeResult([])


def make_event(start, end, busy=True, user_id=1, provider="google"):
    return type(
        "Event",
        (),
        {
            "start": start,
            "end": end,
            "busy": busy,
            "user_id": user_id,
            "provider": provider,
        },
    )()


USER = User(
    timezone="UTC",
    work_start="09:00",
    work_end="18:00",
    lunch_start="13:00",
    lunch_end="14:00",
)


class TestSuggestSlots:
    async def test_free_day_gives_slots_respecting_lunch(self):
        # no events: free ranges are 9:00-13:00 and 14:00-18:00.
        # With 60min duration and 30min step: 7 slots in 9-13, 7 in 14-18 = 14.
        db = FakeDB([])
        slots = await suggest_slots(
            db,
            USER,
            start=datetime(2026, 9, 28, 9, 0),
            end=datetime(2026, 9, 28, 18, 0),
            duration_minutes=60,
            max_results=30,
        )
        assert len(slots) == 14
        # no slot during lunch
        for s in slots:
            assert not (s["start"].hour == 13)

    async def test_respects_busy_meeting(self):
        busy = make_event(
            datetime(2026, 9, 28, 10, 0), datetime(2026, 9, 28, 11, 0)
        )
        db = FakeDB([busy])
        slots = await suggest_slots(
            db,
            USER,
            start=datetime(2026, 9, 28, 9, 0),
            end=datetime(2026, 9, 28, 18, 0),
            duration_minutes=60,
        )
        for s in slots:
            # no slot overlapping 10-11
            assert not (s["start"] < datetime(2026, 9, 28, 11, 0) and s["end"] > datetime(2026, 9, 28, 10, 0))

    async def test_weekend_is_skipped(self):
        # Saturday 2026-09-26 should have no slots
        db = FakeDB([])
        slots = await suggest_slots(
            db,
            USER,
            start=datetime(2026, 9, 26, 9, 0),
            end=datetime(2026, 9, 28, 18, 0),
            duration_minutes=60,
        )
        for s in slots:
            assert s["date"] >= "2026-09-28"

    async def test_duration_validation(self):
        db = FakeDB([])
        with pytest.raises(ValueError):
            await suggest_slots(
                db, USER, start=datetime(2026, 9, 28, 9, 0),
                end=datetime(2026, 9, 28, 18, 0), duration_minutes=0,
            )

    async def test_max_results(self):
        db = FakeDB([])
        slots = await suggest_slots(
            db,
            USER,
            start=datetime(2026, 9, 28, 9, 0),
            end=datetime(2026, 9, 29, 18, 0),
            duration_minutes=60,
            max_results=3,
        )
        assert len(slots) == 3