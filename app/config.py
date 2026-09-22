from functools import lru_cache
import json

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Calendar Bridge"
    environment: str = "development"
    api_prefix: str = "/api/v1"
    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 60
    # Optional API key for multi-user access. Empty = open (single-user/local).
    api_keys: str = ""  # comma-separated list of API keys

    database_url: str = "postgresql+asyncpg://bridge:bridge@localhost:5432/bridge"

    # Google OAuth (default client)
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/v1/auth/google/callback"

    # Extra Google OAuth clients for other Google Workspace orgs.
    # JSON array: [{"name": "sancor", "client_id": "...", "client_secret": "..."}]
    google_extra_clients: str = "[]"

    # Microsoft OAuth
    ms_client_id: str = ""
    ms_client_secret: str = ""
    ms_tenant_id: str = "common"
    ms_redirect_uri: str = "http://localhost:8000/api/v1/auth/microsoft/callback"

    # Published Outlook ICS calendar (read-only, no OAuth needed)
    outlook_ics_url: str = ""

    # Sync
    sync_interval_minutes: int = 15
    sync_lookback_days: int = 30
    sync_lookahead_days: int = 60

    # Working hours (default per user, override via profile)
    default_work_start: str = "09:00"
    default_work_end: str = "18:00"
    default_lunch_start: str = "13:00"
    default_lunch_end: str = "14:00"
    default_timezone: str = "America/Argentina/Buenos_Aires"

    # Notifications (SMTP) — optional
    smtp_server: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "calendar-bridge@local"
    notify_emails: str = ""  # comma-separated recipients
    daily_summary_hour: int = 8  # hour (server time) to send the daily summary

    def google_clients(self) -> list[dict]:
        """All Google OAuth clients: default + extras."""
        clients = [
            {
                "name": "default",
                "client_id": self.google_client_id,
                "client_secret": self.google_client_secret,
            }
        ]
        try:
            extras = json.loads(self.google_extra_clients or "[]")
            for c in extras:
                if c.get("client_id"):
                    clients.append(c)
        except (ValueError, TypeError):
            pass
        return clients


@lru_cache
def get_settings() -> Settings:
    return Settings()