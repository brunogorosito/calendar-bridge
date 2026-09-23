from .base import (
    CalendarProvider,
    CalendarInfo,
    NormalizedEvent,
    NormalizedEmail,
    TokenBundle,
    ProviderError,
)
from .google import GoogleProvider
from .microsoft import MicrosoftProvider
from .ics import IcsProvider

PROVIDERS: dict[str, type[CalendarProvider]] = {
    "google": GoogleProvider,
    "microsoft": MicrosoftProvider,
}


def get_provider(name: str) -> CalendarProvider:
    cls = PROVIDERS.get(name)
    if cls is None:
        raise ProviderError(name, f"unsupported provider '{name}'")
    return cls()


def get_google_client(name: str) -> GoogleProvider:
    """Build a GoogleProvider for a specific OAuth client by name."""
    from ..config import get_settings

    for c in get_settings().google_clients():
        if c.get("name") == name and c.get("client_id"):
            return GoogleProvider(
                client_id=c["client_id"],
                client_secret=c.get("client_secret", ""),
                name=name,
            )
    return GoogleProvider()


def get_google_client_names() -> list[dict]:
    """Return available Google OAuth client names for the login UI."""
    from ..config import get_settings

    return [
        {"name": c.get("name", "default"), "has_credentials": bool(c.get("client_id"))}
        for c in get_settings().google_clients()
    ]


__all__ = [
    "CalendarProvider",
    "CalendarInfo",
    "NormalizedEvent",
    "NormalizedEmail",
    "TokenBundle",
    "ProviderError",
    "GoogleProvider",
    "MicrosoftProvider",
    "get_provider",
    "get_google_client",
    "get_google_client_names",
]