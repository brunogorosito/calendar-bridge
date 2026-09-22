from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from pydantic import BaseModel

from ...database import get_db
from ...models import CalendarEvent, User
from ...schemas import DayView, MonthView, EventOut, WeekView
from ...services.availability import get_day_view, get_month_view, get_week_view, month_start, week_start
from ...services import events as events_svc

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


class EventCreate(BaseModel):
    account_id: int
    summary: str
    start: datetime
    end: datetime
    description: str = ""
    location: str = ""


class EventUpdate(BaseModel):
    summary: str | None = None
    start: datetime | None = None
    end: datetime | None = None
    description: str | None = None
    location: str | None = None


@router.post("/events", response_model=EventOut)
async def create_event(body: EventCreate, db: AsyncSession = Depends(get_db)):
    if not body.summary.strip():
        raise HTTPException(status_code=400, detail="summary is required")
    if body.end <= body.start:
        raise HTTPException(status_code=400, detail="end must be after start")
    try:
        ev = await events_svc.create_event(
            db,
            account_id=body.account_id,
            summary=body.summary,
            start=body.start,
            end=body.end,
            description=body.description,
            location=body.location,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:  # provider errors
        raise HTTPException(status_code=502, detail=str(e))
    from ...models import ProviderAccount

    acct = await db.get(ProviderAccount, body.account_id)
    # persist local copy
    local = CalendarEvent(
        user_id=acct.user_id if acct else 0,
        provider=acct.provider if acct else "google",
        provider_event_id=ev.provider_event_id,
        calendar_id=ev.calendar_id,
        summary=ev.summary,
        description=ev.description,
        location=ev.location,
        start=ev.start,
        end=ev.end,
        all_day=ev.all_day,
        busy=ev.busy,
        online_meeting_url=ev.online_meeting_url,
        raw=ev.raw,
    )
    db.add(local)
    await db.commit()
    await db.refresh(local)
    return local


@router.patch("/events/{event_id}", response_model=EventOut)
async def update_event(event_id: int, body: EventUpdate, db: AsyncSession = Depends(get_db)):
    if body.end is not None and body.start is not None and body.end <= body.start:
        raise HTTPException(status_code=400, detail="end must be after start")
    try:
        await events_svc.update_event(
            db,
            event_id=event_id,
            summary=body.summary,
            start=body.start,
            end=body.end,
            description=body.description,
            location=body.location,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
    refreshed = await events_svc.refresh_event(db, event_id)
    return refreshed


@router.delete("/events/{event_id}")
async def delete_event(event_id: int, db: AsyncSession = Depends(get_db)):
    try:
        await events_svc.delete_event(db, event_id=event_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"deleted": event_id}


def _make_user(tz: str, ws: str, we: str, ls: str, le: str) -> User:
    return User(
        timezone=tz,
        work_start=ws,
        work_end=we,
        lunch_start=ls,
        lunch_end=le,
    )


@router.get("/day/{date}", response_model=DayView)
async def day_view(
    date: str,
    tz: str = "UTC",
    work_start: str = Query("09:00"),
    work_end: str = Query("18:00"),
    lunch_start: str = Query("13:00"),
    lunch_end: str = Query("14:00"),
    db: AsyncSession = Depends(get_db),
):
    day = datetime.fromisoformat(date)
    user = _make_user(tz, work_start, work_end, lunch_start, lunch_end)
    return await get_day_view(db, user, day)


@router.get("/week/{date}", response_model=WeekView)
async def week_view(
    date: str,
    tz: str = "UTC",
    work_start: str = Query("09:00"),
    work_end: str = Query("18:00"),
    lunch_start: str = Query("13:00"),
    lunch_end: str = Query("14:00"),
    db: AsyncSession = Depends(get_db),
):
    day = datetime.fromisoformat(date)
    user = _make_user(tz, work_start, work_end, lunch_start, lunch_end)
    return await get_week_view(db, user, week_start(day))


@router.get("/month/{date}", response_model=MonthView)
async def month_view(
    date: str,
    tz: str = "UTC",
    work_start: str = Query("09:00"),
    work_end: str = Query("18:00"),
    lunch_start: str = Query("13:00"),
    lunch_end: str = Query("14:00"),
    db: AsyncSession = Depends(get_db),
):
    day = datetime.fromisoformat(date)
    user = _make_user(tz, work_start, work_end, lunch_start, lunch_end)
    return await get_month_view(db, user, month_start(day))