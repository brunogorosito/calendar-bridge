from datetime import datetime

from pydantic import BaseModel


class EventOut(BaseModel):
    id: int
    provider: str
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

    model_config = {"from_attributes": True}


class EmailOut(BaseModel):
    id: int
    provider: str
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

    model_config = {"from_attributes": True}


class TimeBlock(BaseModel):
    start: datetime
    end: datetime
    busy: bool
    source: str  # google | microsoft | working_hours
    summary: str = ""
    description: str = ""
    location: str = ""
    online_meeting_url: str | None = None


class DayView(BaseModel):
    date: str  # YYYY-MM-DD
    work_start: str
    work_end: str
    lunch_start: str = "13:00"
    lunch_end: str = "14:00"
    is_workday: bool = True
    holiday: str | None = None
    blocks: list[TimeBlock]
    busy_minutes: int
    free_minutes: int


class WeekView(BaseModel):
    days: list[DayView]


class MonthView(BaseModel):
    weeks: list[list[DayView]]


class AccountOut(BaseModel):
    id: int
    provider: str
    provider_email: str
    client_name: str | None = None
    scopes: list[str]
    linked: bool = True

    model_config = {"from_attributes": True}


class GoogleClientOut(BaseModel):
    name: str
    has_credentials: bool