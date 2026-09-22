from fastapi import Depends, Header, HTTPException

from ..config import get_settings


def require_api_key(x_api_key: str | None = Header(None)) -> None:
    """Enforce X-API-Key header if API keys are configured."""
    settings = get_settings()
    keys = [k.strip() for k in (settings.api_keys or "").split(",") if k.strip()]
    if not keys:
        return  # open mode (local/single-user)
    if not x_api_key or x_api_key not in keys:
        raise HTTPException(status_code=401, detail="Invalid or missing X-API-Key")