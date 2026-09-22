from .base import CalendarProvider, NormalizedEvent, NormalizedEmail, TokenBundle, ProviderError
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


__all__ = [
    "CalendarProvider",
    "NormalizedEvent",
    "NormalizedEmail",
    "TokenBundle",
    "ProviderError",
    "GoogleProvider",
    "MicrosoftProvider",
    "get_provider",
]