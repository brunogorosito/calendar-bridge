from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage
from email.utils import formatdate
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..models import User
from .availability import get_day_view

log = logging.getLogger("notify")


async def build_daily_summary(db: AsyncSession, day: datetime) -> str:
    user = User(
        timezone=get_settings().default_timezone,
        work_start=get_settings().default_work_start,
        work_end=get_settings().default_work_end,
        lunch_start=get_settings().default_lunch_start,
        lunch_end=get_settings().default_lunch_end,
    )
    view = await get_day_view(db, user, day)

    lines = []
    lines.append(f"Resumen de {view.date} ({'laboral' if view.is_workday else 'no laboral'})")
    if view.holiday:
        lines.append(f"Feriado: {view.holiday}")
    lines.append("")
    lines.append(f"Ocupado: {view.busy_minutes} min · Libre: {view.free_minutes} min")
    lines.append("")

    meetings = [b for b in view.blocks if b.busy and b.source != "lunch"]
    if not meetings:
        lines.append("Sin reuniones.")
    for b in meetings:
        lines.append(f"- {b.start.strftime('%H:%M')}–{b.end.strftime('%H:%M')} {b.summary} ({b.source})")
    return "\n".join(lines)


def send_email(subject: str, body: str) -> bool:
    s = get_settings()
    if not s.smtp_server or not s.smtp_user or not s.smtp_password:
        log.info("SMTP not configured; skipping email: %s", subject)
        return False
    recipients = [r.strip() for r in (s.notify_emails or "").split(",") if r.strip()]
    if not recipients:
        log.info("notify_emails empty; skipping email")
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = s.smtp_from
    msg["To"] = ", ".join(recipients)
    msg["Date"] = formatdate(localtime=True)
    msg.set_content(body)

    try:
        with smtplib.SMTP(s.smtp_server, s.smtp_port, timeout=30) as server:
            server.starttls()
            server.login(s.smtp_user, s.smtp_password)
            server.send_message(msg)
        log.info("email sent to %s", ", ".join(recipients))
        return True
    except Exception as exc:  # noqa: BLE001
        log.error("email failed: %s", exc)
        return False


async def send_daily_summary(db: AsyncSession) -> bool:
    from ..config import get_settings as _s

    settings = _s()
    tomorrow = datetime.utcnow() + timedelta(days=1)
    body = await build_daily_summary(db, tomorrow.replace(hour=0, minute=0, second=0, microsecond=0))
    return send_email(f"Calendar Bridge · {tomorrow.strftime('%A %d/%m/%Y')}", body)