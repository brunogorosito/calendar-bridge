from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import CalendarEvent, ProviderAccount
from ..providers import NormalizedEvent, get_google_client, get_provider
from .tokens import get_valid_token


async def _provider_for(account: ProviderAccount):
    if account.provider == "google":
        return get_google_client(account.client_name or "default")
    return get_provider(account.provider)


async def create_event(
    db: AsyncSession,
    *,
    account_id: int,
    summary: str,
    start: datetime,
    end: datetime,
    description: str = "",
    location: str = "",
) -> NormalizedEvent:
    account = await db.get(ProviderAccount, account_id)
    if account is None:
        raise ValueError("account not found")
    token = await get_valid_token(db, account)
    provider = await _provider_for(account)
    return await provider.create_event(
        token,
        summary=summary,
        start=start,
        end=end,
        description=description,
        location=location,
    )


async def update_event(
    db: AsyncSession,
    *,
    event_id: int,
    summary: str | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    description: str | None = None,
    location: str | None = None,
) -> NormalizedEvent:
    event = await db.get(CalendarEvent, event_id)
    if event is None:
        raise ValueError("event not found")
    result = await db.execute(
        select(ProviderAccount).where(
            ProviderAccount.user_id == event.user_id,
            ProviderAccount.provider == event.provider,
        )
    )
    account = result.scalar_one_or_none()
    if account is None:
        raise ValueError("account for event not found")
    token = await get_valid_token(db, account)
    provider = await _provider_for(account)
    return await provider.update_event(
        token,
        event.provider_event_id,
        summary=summary,
        start=start,
        end=end,
        description=description,
        location=location,
        calendar_id=event.calendar_id,
    )


async def delete_event(db: AsyncSession, *, event_id: int) -> None:
    event = await db.get(CalendarEvent, event_id)
    if event is None:
        raise ValueError("event not found")
    result = await db.execute(
        select(ProviderAccount).where(
            ProviderAccount.user_id == event.user_id,
            ProviderAccount.provider == event.provider,
        )
    )
    account = result.scalar_one_or_none()
    if account is not None:
        token = await get_valid_token(db, account)
        provider = await _provider_for(account)
        try:
            await provider.delete_event(
                token, event.provider_event_id, calendar_id=event.calendar_id
            )
        except Exception:
            # even if remote delete fails, remove the local copy
            pass
    await db.delete(event)
    await db.commit()


async def refresh_event(db: AsyncSession, event_id: int) -> CalendarEvent:
    """Re-fetch a single event from its provider and update the local copy."""
    event = await db.get(CalendarEvent, event_id)
    if event is None:
        raise ValueError("event not found")
    result = await db.execute(
        select(ProviderAccount).where(
            ProviderAccount.user_id == event.user_id,
            ProviderAccount.provider == event.provider,
        )
    )
    account = result.scalar_one_or_none()
    if account is None:
        return event
    token = await get_valid_token(db, account)
    provider = await _provider_for(account)
    events = await provider.list_events(token, event.start, event.end)
    remote = next((e for e in events if e.provider_event_id == event.provider_event_id), None)
    if remote is None:
        await db.delete(event)
        await db.commit()
        return event
    event.summary = remote.summary
    event.description = remote.description
    event.location = remote.location
    event.start = remote.start
    event.end = remote.end
    event.online_meeting_url = remote.online_meeting_url
    await db.commit()
    await db.refresh(event)
    return event