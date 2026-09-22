from __future__ import annotations

import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.config import get_settings
from app.database import SessionLocal
from app.models import ProviderAccount
from app.services.sync import sync_account_calendar, sync_account_emails

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("worker")

settings = get_settings()


async def sync_all():
    async with SessionLocal() as db:
        from sqlalchemy import select

        from app.services.sync import sync_ics_calendar

        try:
            result = await sync_ics_calendar(db)
            log.info("synced ICS: %s events", result["events"])
        except Exception as exc:  # noqa: BLE001
            log.error("ICS sync failed: %s", exc)

        result = await db.execute(select(ProviderAccount))
        accounts = result.scalars().all()
        for acc in accounts:
            try:
                cal = await sync_account_calendar(db, acc)
                mail = await sync_account_emails(db, acc)
                log.info("synced %s: %s events, %s emails", acc.provider, cal["events"], mail["emails"])
            except Exception as exc:  # noqa: BLE001
                log.error("sync failed for %s (%s): %s", acc.provider, acc.provider_email, exc)


async def main():
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        sync_all,
        IntervalTrigger(minutes=settings.sync_interval_minutes),
        id="sync_all",
        replace_existing=True,
    )
    scheduler.start()
    log.info("worker started, interval=%s min", settings.sync_interval_minutes)
    try:
        await asyncio.Event().wait()
    except (KeyboardInterrupt, asyncio.CancelledError):
        scheduler.shutdown()


if __name__ == "__main__":
    asyncio.run(main())