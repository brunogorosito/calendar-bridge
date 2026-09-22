from __future__ import annotations

from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx

from ..config import get_settings
from .base import CalendarProvider, NormalizedEmail, NormalizedEvent, ProviderError, TokenBundle

SCOPES = [
    "offline_access",
    "User.Read",
    "Calendars.Read",
    "Mail.Read",
    "OnlineMeetings.Read",
]

AUTH_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize"
TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
GRAPH_URL = "https://graph.microsoft.com/v1.0"


class MicrosoftProvider(CalendarProvider):
    name = "microsoft"

    def __init__(self):
        s = get_settings()
        self.client_id = s.ms_client_id
        self.client_secret = s.ms_client_secret
        self.tenant = s.ms_tenant_id
        self.redirect_uri = s.ms_redirect_uri

    def auth_url(self, state: str) -> str:
        params = urlencode(
            {
                "client_id": self.client_id,
                "response_type": "code",
                "redirect_uri": self.redirect_uri,
                "response_mode": "query",
                "scope": " ".join(SCOPES),
                "state": state,
            }
        )
        return f"{AUTH_URL.format(tenant=self.tenant)}?{params}"

    async def _post_token(self, data: dict) -> TokenBundle:
        async with httpx.AsyncClient() as client:
            resp = await client.post(TOKEN_URL.format(tenant=self.tenant), data=data)
            if resp.status_code != 200:
                raise ProviderError(self.name, f"token exchange failed: {resp.text}")
            payload = resp.json()
        return TokenBundle(
            access_token=payload["access_token"],
            refresh_token=payload.get("refresh_token"),
            expires_at=datetime.now(timezone.utc).replace(tzinfo=None)
            + timedelta(seconds=payload.get("expires_in", 3600)),
            scopes=payload.get("scope", "").split(),
            email=payload.get("preferred_username", ""),
        )

    async def exchange_code(self, code: str) -> TokenBundle:
        return await self._post_token(
            {
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "code": code,
                "redirect_uri": self.redirect_uri,
                "grant_type": "authorization_code",
                "scope": " ".join(SCOPES),
            }
        )

    async def refresh(self, refresh_token: str) -> TokenBundle:
        return await self._post_token(
            {
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
                "scope": " ".join(SCOPES),
            }
        )

    async def _graph_get(self, access_token: str, path: str, params: dict | None = None) -> dict:
        headers = {"Authorization": f"Bearer {access_token}"}
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{GRAPH_URL}/{path}", params=params, headers=headers)
            if resp.status_code != 200:
                raise ProviderError(self.name, f"GET {path} failed: {resp.text}")
            return resp.json()

    async def list_events(
        self, access_token: str, time_min: datetime, time_max: datetime
    ) -> list[NormalizedEvent]:
        params = {
            "startDateTime": time_min.isoformat(),
            "endDateTime": time_max.isoformat(),
            "$select": "id,subject,bodyPreview,location,start,end,isAllDay,showAs,onlineMeeting,organizer",
            "$top": 200,
        }
        data = await self._graph_get(access_token, "me/calendarView", params)
        events = []
        for item in data.get("value", []):
            online_url = None
            om = item.get("onlineMeeting")
            if om:
                online_url = om.get("joinUrl") or om.get("joinWebUrl")
            events.append(
                NormalizedEvent(
                    provider_event_id=item["id"],
                    calendar_id=item.get("organizer", {}).get("emailAddress", {}).get("address", "primary"),
                    summary=item.get("subject", ""),
                    description=item.get("bodyPreview", ""),
                    location=item.get("location", {}).get("displayName", ""),
                    start=datetime.fromisoformat(item["start"]["dateTime"]).replace(tzinfo=None),
                    end=datetime.fromisoformat(item["end"]["dateTime"]).replace(tzinfo=None),
                    all_day=item.get("isAllDay", False),
                    busy=item.get("showAs") in ("busy", "tentative", "oof"),
                    online_meeting_url=online_url,
                    raw=item,
                )
            )
        return events

    async def list_emails(
        self, access_token: str, since: datetime, limit: int = 50
    ) -> list[NormalizedEmail]:
        params = {
            "$select": "id,subject,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,isRead,hasAttachments,conversationId",
            "$top": limit,
            "$orderby": "receivedDateTime desc",
        }
        # filter only if since is in the past
        if since:
            params["$filter"] = f"receivedDateTime ge {since.isoformat()}Z"
        data = await self._graph_get(access_token, "me/messages", params)
        emails = []
        for item in data.get("value", []):
            to = [r.get("emailAddress", {}).get("address", "") for r in item.get("toRecipients", [])]
            cc = [r.get("emailAddress", {}).get("address", "") for r in item.get("ccRecipients", [])]
            frm = item.get("from", {}).get("emailAddress", {})
            emails.append(
                NormalizedEmail(
                    provider_message_id=item["id"],
                    thread_id=item.get("conversationId", ""),
                    subject=item.get("subject", ""),
                    body_preview=(item.get("bodyPreview") or "")[:500],
                    from_name=frm.get("name", ""),
                    from_email=frm.get("address", ""),
                    to=[x for x in to if x],
                    cc=[x for x in cc if x],
                    received_at=datetime.fromisoformat(item["receivedDateTime"].replace("Z", "+00:00")).replace(tzinfo=None),
                    is_read=item.get("isRead", False),
                    has_attachments=item.get("hasAttachments", False),
                    labels=[],
                    raw=item,
                )
            )
        return emails

    async def _graph_send(self, access_token: str, method: str, path: str, body: dict | None = None) -> dict:
        headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
        async with httpx.AsyncClient() as client:
            resp = await client.request(method, f"{GRAPH_URL}/{path}", json=body, headers=headers)
            if resp.status_code not in (200, 201, 204):
                raise ProviderError(self.name, f"{method} {path} failed: {resp.text}")
            return resp.json() if resp.content else {}

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
        body = {
            "subject": summary,
            "body": {"contentType": "text", "content": description or ""},
            "location": {"displayName": location},
            "start": {"dateTime": start.isoformat(), "timeZone": "UTC"},
            "end": {"dateTime": end.isoformat(), "timeZone": "UTC"},
        }
        data = await self._graph_send(access_token, "POST", "me/events", body)
        return self._from_item(data)

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
        body = {}
        if summary is not None:
            body["subject"] = summary
        if description is not None:
            body["body"] = {"contentType": "text", "content": description}
        if location is not None:
            body["location"] = {"displayName": location}
        if start is not None:
            body["start"] = {"dateTime": start.isoformat(), "timeZone": "UTC"}
        if end is not None:
            body["end"] = {"dateTime": end.isoformat(), "timeZone": "UTC"}
        data = await self._graph_send(
            access_token, "PATCH", f"me/events/{provider_event_id}", body
        )
        return self._from_item(data)

    async def delete_event(
        self, access_token: str, provider_event_id: str, calendar_id: str = "primary"
    ) -> None:
        await self._graph_send(access_token, "DELETE", f"me/events/{provider_event_id}")

    @staticmethod
    def _from_item(item: dict) -> NormalizedEvent:
        online_url = None
        om = item.get("onlineMeeting")
        if om:
            online_url = om.get("joinUrl") or om.get("joinWebUrl")
        return NormalizedEvent(
            provider_event_id=item["id"],
            calendar_id=item.get("organizer", {}).get("emailAddress", {}).get("address", "primary"),
            summary=item.get("subject", ""),
            description=item.get("bodyPreview", ""),
            location=item.get("location", {}).get("displayName", ""),
            start=datetime.fromisoformat(item["start"]["dateTime"]).replace(tzinfo=None),
            end=datetime.fromisoformat(item["end"]["dateTime"]).replace(tzinfo=None),
            all_day=item.get("isAllDay", False),
            busy=item.get("showAs") in ("busy", "tentative", "oof"),
            online_meeting_url=online_url,
            raw=item,
        )