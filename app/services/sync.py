from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..models import CalendarEvent, EmailMessage, ProviderAccount
from ..providers import CalendarInfo, get_provider


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _window() -> tuple[datetime, datetime]:
    s = get_settings()
    return (
        _utcnow() - timedelta(days=s.sync_lookback_days),
        _utcnow() + timedelta(days=s.sync_lookahead_days),
    )


async def _ensure_default_user(db: AsyncSession) -> int:
    """Create or reuse the default single-user account."""
    from ..models import User

    result = await db.execute(
        select(User).where(User.email == "bridge@local")
    )
    user = result.scalar_one_or_none()
    if user is None:
        user = User(email="bridge@local", name="Calendar Bridge")
        db.add(user)
        await db.flush()
    return user.id


async def sync_ics_calendar(db: AsyncSession, user_id: int | None = None) -> dict:
    """Pull events from the published Outlook ICS into the local DB (no OAuth)."""
    from ..providers.ics import IcsProvider

    provider = IcsProvider()
    time_min, time_max = _window()
    events = await provider.list_events("", time_min, time_max)

    if user_id is None:
        user_id = await _ensure_default_user(db)
    await db.execute(
        delete(CalendarEvent).where(
            CalendarEvent.user_id == user_id,
            CalendarEvent.provider == "microsoft_ics",
        )
    )
    for ev in events:
        db.add(
            CalendarEvent(
                user_id=user_id,
                provider="microsoft_ics",
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
        )
    await db.commit()
    return {"provider": "microsoft_ics", "events": len(events)}


async def sync_account_calendar(db: AsyncSession, account: ProviderAccount) -> dict:
    from .tokens import get_valid_token

    token = await get_valid_token(db, account)
    provider = get_provider(account.provider)
    time_min, time_max = _window()

    # fetch all calendars of the account
    calendars = await provider.list_calendars(token)
    if not calendars:
        calendars = [CalendarInfo(calendar_id="primary", name="Principal")]

    name_by_id = {c.calendar_id: c.name for c in calendars}

    # replace the window for this account (simple, idempotent approach)
    await db.execute(
        delete(CalendarEvent).where(
            CalendarEvent.user_id == account.user_id,
            CalendarEvent.provider == account.provider,
        )
    )

    total = 0
    for cal in calendars:
        if not cal.selected:
            continue
        events = await provider.list_events(token, time_min, time_max, cal.calendar_id)
        for ev in events:
            db.add(
                CalendarEvent(
                    user_id=account.user_id,
                    provider=account.provider,
                    provider_event_id=ev.provider_event_id,
                    calendar_id=ev.calendar_id,
                    calendar_name=name_by_id.get(ev.calendar_id, ev.calendar_id),
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
            )
            total += 1
    await db.commit()
    return {"provider": account.provider, "calendars": len([c for c in calendars if c.selected]), "events": total}


async def sync_account_emails(db: AsyncSession, account: ProviderAccount) -> dict:
    from .tokens import get_valid_token

    token = await get_valid_token(db, account)
    provider = get_provider(account.provider)
    since = _utcnow() - timedelta(days=30)
    emails = await provider.list_emails(token, since)

    await db.execute(
        delete(EmailMessage).where(
            EmailMessage.user_id == account.user_id,
            EmailMessage.provider == account.provider,
        )
    )
    for em in emails:
        db.add(
            EmailMessage(
                user_id=account.user_id,
                provider=account.provider,
                provider_message_id=em.provider_message_id,
                thread_id=em.thread_id,
                subject=em.subject,
                body_preview=em.body_preview,
                from_name=em.from_name,
                from_email=em.from_email,
                to=em.to,
                cc=em.cc,
                received_at=em.received_at,
                is_read=em.is_read,
                has_attachments=em.has_attachments,
                labels=em.labels,
                raw=em.raw,
            )
        )
    await db.commit()
    return {"provider": account.provider, "emails": len(emails)}


async def sync_user(db: AsyncSession, user_id: int, *, emails: bool = True) -> dict:
    result = await db.execute(
        select(ProviderAccount).where(ProviderAccount.user_id == user_id)
    )
    accounts = result.scalars().all()
    summary = {"calendars": [], "emails": []}
    for acc in accounts:
        summary["calendars"].append(await sync_account_calendar(db, acc))
        if emails:
            summary["emails"].append(await sync_account_emails(db, acc))
    return summary