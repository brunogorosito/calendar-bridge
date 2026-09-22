from __future__ import annotations

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import httpx
import recurring_ical_events
from icalendar import Calendar

from ..config import get_settings
from .base import CalendarProvider, NormalizedEmail, NormalizedEvent, ProviderError, TokenBundle

TZ = ZoneInfo(get_settings().default_timezone)


class IcsProvider(CalendarProvider):
    """Read-only calendar provider that consumes a published ICS URL.

    Used to read the Microsoft/Outlook calendar of aunesa without OAuth.
    """

    name = "microsoft_ics"

    def __init__(self, url: str = ""):
        s = get_settings()
        self.url = url or s.outlook_ics_url

    def auth_url(self, state: str) -> str:
        raise ProviderError(self.name, "ICS provider does not use OAuth")

    async def exchange_code(self, code: str) -> TokenBundle:
        raise ProviderError(self.name, "ICS provider does not use OAuth")

    async def refresh(self, refresh_token: str) -> TokenBundle:
        raise ProviderError(self.name, "ICS provider does not use OAuth")

    async def list_events(
        self, access_token: str, time_min: datetime, time_max: datetime
    ) -> list[NormalizedEvent]:
        if not self.url:
            return []
        async with httpx.AsyncClient(follow_redirects=True) as client:
            resp = await client.get(self.url, timeout=30)
            if resp.status_code != 200:
                raise ProviderError(self.name, f"ICS fetch failed: {resp.status_code}")
            cal = Calendar.from_ical(resp.content)

        events: list[NormalizedEvent] = []
        for event in recurring_ical_events.of(cal).between(time_min, time_max):
            dtstart = event.get("DTSTART").dt
            dtend = event.get("DTEND").dt
            if not isinstance(dtstart, datetime):
                dtstart = datetime.combine(dtstart, datetime.min.time())
            if not isinstance(dtend, datetime):
                dtend = datetime.combine(dtend, datetime.min.time())
            if dtstart.tzinfo:
                dtstart = dtstart.astimezone(TZ).replace(tzinfo=None)
            if dtend.tzinfo:
                dtend = dtend.astimezone(TZ).replace(tzinfo=None)

            summary = str(event.get("SUMMARY", ""))
            if summary.startswith(("Cancelado:", "Canceled:")):
                continue
            events.append(
                NormalizedEvent(
                    provider_event_id=str(event.get("UID", "")),
                    calendar_id="outlook",
                    summary=summary,
                    description=str(event.get("DESCRIPTION", "")),
                    location=str(event.get("LOCATION", "")),
                    start=dtstart,
                    end=dtend,
                    all_day=dtstart.hour == 0 and dtend.hour == 0 and (dtend - dtstart) >= timedelta(days=1),
                    busy=True,
                    online_meeting_url=str(event.get("URL", "") or ""),
                    raw={"ics": True},
                )
            )
        return events

    async def list_emails(
        self, access_token: str, since: datetime, limit: int = 50
    ) -> list[NormalizedEmail]:
        return []  # ICS has no inbox

    async def create_event(self, **kwargs) -> NormalizedEvent:
        raise ProviderError(self.name, "ICS calendar is read-only")

    async def update_event(self, *args, **kwargs) -> NormalizedEvent:
        raise ProviderError(self.name, "ICS calendar is read-only")

    async def delete_event(self, *args, **kwargs) -> None:
        raise ProviderError(self.name, "ICS calendar is read-only")