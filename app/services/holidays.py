from __future__ import annotations

import logging
from datetime import datetime
from functools import lru_cache

import httpx

log = logging.getLogger("holidays")

AR_HOLIDAYS_API = "https://date.nager.at/api/v3/PublicHolidays/{year}/AR"


@lru_cache(maxsize=8)
def get_ar_holidays(year: int) -> dict[str, str]:
    """Return {YYYY-MM-DD: local_name} for all AR national holidays in a year.

    Uses the Nager.Date API (same source used by renaiss-hub-sync).
    """
    try:
        resp = httpx.get(AR_HOLIDAYS_API.format(year=year), timeout=10, follow_redirects=True)
        resp.raise_for_status()
        return {h["date"]: h["localName"] for h in resp.json()}
    except Exception as exc:  # noqa: BLE001
        log.warning("could not fetch AR holidays for %s: %s", year, exc)
        return {}


def holiday_on(date_str: str) -> str | None:
    """Return the holiday local name for a date (YYYY-MM-DD), or None."""
    try:
        year = int(date_str[:4])
    except (TypeError, ValueError):
        return None
    return get_ar_holidays(year).get(date_str)


def is_holiday(dt: datetime) -> bool:
    return holiday_on(dt.strftime("%Y-%m-%d")) is not None