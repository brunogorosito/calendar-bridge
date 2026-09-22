from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class TokenBundle:
    access_token: str
    refresh_token: str | None
    expires_at: datetime | None
    scopes: list[str] = field(default_factory=list)
    email: str = ""


@dataclass
class NormalizedEvent:
    provider_event_id: str
    calendar_id: str
    summary: str
    description: str
    location: str
    start: datetime
    end: datetime
    all_day: bool
    busy: bool
    online_meeting_url: str | None
    raw: dict


@dataclass
class NormalizedEmail:
    provider_message_id: str
    thread_id: str
    subject: str
    body_preview: str
    from_name: str
    from_email: str
    to: list[str]
    cc: list[str]
    received_at: datetime
    is_read: bool
    has_attachments: bool
    labels: list[str]
    raw: dict


class CalendarProvider(ABC):
    """Common interface for Google Calendar / Microsoft Graph calendars."""

    name: str

    @abstractmethod
    def auth_url(self, state: str) -> str: ...

    @abstractmethod
    async def exchange_code(self, code: str) -> TokenBundle: ...

    @abstractmethod
    async def refresh(self, refresh_token: str) -> TokenBundle: ...

    @abstractmethod
    async def list_events(
        self, access_token: str, time_min: datetime, time_max: datetime
    ) -> list[NormalizedEvent]: ...

    @abstractmethod
    async def list_emails(
        self, access_token: str, since: datetime, limit: int = 50
    ) -> list[NormalizedEmail]: ...

    # --- write operations (create/update/delete events) ---

    @abstractmethod
    async def create_event(
        self,
        access_token: str,
        *,
        summary: str,
        start: datetime,
        end: datetime,
        description: str = "",
        location: str = "",
        calendar_id: str = "primary",
    ) -> NormalizedEvent: ...

    @abstractmethod
    async def update_event(
        self,
        access_token: str,
        provider_event_id: str,
        *,
        summary: str | None = None,
        start: datetime | None = None,
        end: datetime | None = None,
        description: str | None = None,
        location: str | None = None,
        calendar_id: str = "primary",
    ) -> NormalizedEvent: ...

    @abstractmethod
    async def delete_event(
        self, access_token: str, provider_event_id: str, calendar_id: str = "primary"
    ) -> None: ...


class ProviderError(Exception):
    def __init__(self, provider: str, message: str):
        self.provider = provider
        self.message = message
        super().__init__(f"[{provider}] {message}")