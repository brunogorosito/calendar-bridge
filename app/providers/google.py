from __future__ import annotations

from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx

from ..config import get_settings
from .base import CalendarProvider, NormalizedEmail, NormalizedEvent, ProviderError, TokenBundle

SCOPES = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/gmail.readonly",
]

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
CALENDAR_URL = "https://www.googleapis.com/calendar/v3"
GMAIL_URL = "https://gmail.googleapis.com/gmail/v1"


class GoogleProvider(CalendarProvider):
    name = "google"

    def __init__(self, client_id: str = "", client_secret: str = "", name: str = "default"):
        s = get_settings()
        self.client_name = name
        self.client_id = client_id or s.google_client_id
        self.client_secret = client_secret or s.google_client_secret
        self.redirect_uri = s.google_redirect_uri

    def auth_url(self, state: str) -> str:
        params = urlencode(
            {
                "client_id": self.client_id,
                "redirect_uri": self.redirect_uri,
                "response_type": "code",
                "scope": " ".join(SCOPES),
                "access_type": "offline",
                "prompt": "consent",
                "include_granted_scopes": "true",
                "state": state,
            }
        )
        return f"{AUTH_URL}?{params}"

    async def _post_token(self, data: dict) -> TokenBundle:
        async with httpx.AsyncClient() as client:
            resp = await client.post(TOKEN_URL, data=data)
            if resp.status_code != 200:
                raise ProviderError(self.name, f"token exchange failed: {resp.text}")
            payload = resp.json()

            email = payload.get("email", "")
            if not email:
                userinfo = await client.get(
                    "https://openidconnect.googleapis.com/v1/userinfo",
                    headers={"Authorization": f"Bearer {payload['access_token']}"},
                )
                if userinfo.status_code == 200:
                    email = userinfo.json().get("email", "")

        return TokenBundle(
            access_token=payload["access_token"],
            refresh_token=payload.get("refresh_token"),
            expires_at=datetime.now(timezone.utc).replace(tzinfo=None)
            + timedelta(seconds=payload.get("expires_in", 3600)),
            scopes=payload.get("scope", "").split(),
            email=email,
        )

    async def exchange_code(self, code: str) -> TokenBundle:
        return await self._post_token(
            {
                "code": code,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "redirect_uri": self.redirect_uri,
                "grant_type": "authorization_code",
            }
        )

    async def refresh(self, refresh_token: str) -> TokenBundle:
        return await self._post_token(
            {
                "refresh_token": refresh_token,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "grant_type": "refresh_token",
            }
        )

    async def list_events(
        self, access_token: str, time_min: datetime, time_max: datetime
    ) -> list[NormalizedEvent]:
        params = {
            "timeMin": time_min.isoformat() + "Z",
            "timeMax": time_max.isoformat() + "Z",
            "singleEvents": "true",
            "orderBy": "startTime",
            "maxResults": 500,
        }
        headers = {"Authorization": f"Bearer {access_token}"}
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{CALENDAR_URL}/calendars/primary/events", params=params, headers=headers
            )
            if resp.status_code != 200:
                raise ProviderError(self.name, f"list_events failed: {resp.text}")
            data = resp.json()

        events = []
        for item in data.get("items", []):
            start_raw = item.get("start", {})
            end_raw = item.get("end", {})
            start = self._parse_dt(start_raw)
            end = self._parse_dt(end_raw)
            if start is None or end is None:
                continue
            online_url = None
            conference = item.get("conferenceData", {}).get("entryPoints", [])
            for ep in conference:
                if ep.get("entryPointType") in ("video", "hangout"):
                    online_url = ep.get("uri")
                    break
            events.append(
                NormalizedEvent(
                    provider_event_id=item["id"],
                    calendar_id=item.get("organizer", {}).get("email", "primary"),
                    summary=item.get("summary", ""),
                    description=item.get("description", ""),
                    location=item.get("location", ""),
                    start=start,
                    end=end,
                    all_day=not start_raw.get("dateTime"),
                    busy=item.get("transparency", "opaque") == "opaque",
                    online_meeting_url=online_url,
                    raw=item,
                )
            )
        return events

    async def list_emails(
        self, access_token: str, since: datetime, limit: int = 50
    ) -> list[NormalizedEmail]:
        headers = {"Authorization": f"Bearer {access_token}"}
        query = f"newer_than:1d" if since is None else f"after:{int(since.timestamp())}"
        params = {"q": query, "maxResults": limit}
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{GMAIL_URL}/users/me/messages", params=params, headers=headers)
            if resp.status_code != 200:
                raise ProviderError(self.name, f"list_emails failed: {resp.text}")
            messages = resp.json().get("messages", [])

            emails = []
            for m in messages:
                detail = await client.get(
                    f"{GMAIL_URL}/users/me/messages/{m['id']}",
                    params={"format": "metadata"},
                    headers=headers,
                )
                if detail.status_code != 200:
                    continue
                emails.append(self._parse_message(detail.json()))
            return emails

    @staticmethod
    def _iso(dt: datetime) -> str:
        return dt.isoformat() + "Z"

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
    ) -> NormalizedEvent:
        headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
        body = {
            "summary": summary,
            "description": description,
            "location": location,
            "start": {"dateTime": self._iso(start), "timeZone": "UTC"},
            "end": {"dateTime": self._iso(end), "timeZone": "UTC"},
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{CALENDAR_URL}/calendars/{calendar_id}/events", json=body, headers=headers
            )
            if resp.status_code not in (200, 201):
                raise ProviderError(self.name, f"create_event failed: {resp.text}")
            item = resp.json()
        return self._from_item(item)

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
    ) -> NormalizedEvent:
        headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
        body = {}
        if summary is not None:
            body["summary"] = summary
        if description is not None:
            body["description"] = description
        if location is not None:
            body["location"] = location
        if start is not None:
            body["start"] = {"dateTime": self._iso(start), "timeZone": "UTC"}
        if end is not None:
            body["end"] = {"dateTime": self._iso(end), "timeZone": "UTC"}
        async with httpx.AsyncClient() as client:
            resp = await client.patch(
                f"{CALENDAR_URL}/calendars/{calendar_id}/events/{provider_event_id}",
                json=body,
                headers=headers,
            )
            if resp.status_code != 200:
                raise ProviderError(self.name, f"update_event failed: {resp.text}")
            item = resp.json()
        return self._from_item(item)

    async def delete_event(
        self, access_token: str, provider_event_id: str, calendar_id: str = "primary"
    ) -> None:
        headers = {"Authorization": f"Bearer {access_token}"}
        async with httpx.AsyncClient() as client:
            resp = await client.delete(
                f"{CALENDAR_URL}/calendars/{calendar_id}/events/{provider_event_id}",
                headers=headers,
            )
            if resp.status_code not in (200, 204):
                raise ProviderError(self.name, f"delete_event failed: {resp.text}")

    @staticmethod
    def _from_item(item: dict) -> NormalizedEvent:
        start_raw = item.get("start", {})
        end_raw = item.get("end", {})
        start = GoogleProvider._parse_dt(start_raw) or datetime.utcnow()
        end = GoogleProvider._parse_dt(end_raw) or start
        online_url = None
        conference = item.get("conferenceData", {}).get("entryPoints", [])
        for ep in conference:
            if ep.get("entryPointType") in ("video", "hangout"):
                online_url = ep.get("uri")
                break
        return NormalizedEvent(
            provider_event_id=item["id"],
            calendar_id=item.get("organizer", {}).get("email", "primary"),
            summary=item.get("summary", ""),
            description=item.get("description", ""),
            location=item.get("location", ""),
            start=start,
            end=end,
            all_day=not start_raw.get("dateTime"),
            busy=item.get("transparency", "opaque") == "opaque",
            online_meeting_url=online_url,
            raw=item,
        )

    @staticmethod
    def _parse_message(msg: dict) -> NormalizedEmail:
        headers = {h["name"].lower(): h["value"] for h in msg.get("payload", {}).get("headers", [])}
        to = [a.strip() for a in headers.get("to", "").split(",") if a.strip()]
        cc = [a.strip() for a in headers.get("cc", "").split(",") if a.strip()]
        return NormalizedEmail(
            provider_message_id=msg["id"],
            thread_id=msg.get("threadId", ""),
            subject=headers.get("subject", ""),
            body_preview=(msg.get("snippet") or "")[:500],
            from_name=headers.get("from", ""),
            from_email=headers.get("from", ""),
            to=to,
            cc=cc,
            received_at=datetime.fromtimestamp(int(msg["internalDate"]) / 1000),
            is_read="UNREAD" not in msg.get("labelIds", []),
            has_attachments=any(p.get("filename") for p in msg.get("payload", {}).get("parts", [])),
            labels=msg.get("labelIds", []),
            raw=msg,
        )

    @staticmethod
    def _parse_dt(raw: dict) -> datetime | None:
        if "dateTime" in raw:
            return datetime.fromisoformat(raw["dateTime"].replace("Z", "+00:00")).replace(tzinfo=None)
        if "date" in raw:
            return datetime.fromisoformat(raw["date"])
        return None