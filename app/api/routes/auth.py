from __future__ import annotations

import secrets
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...config import get_settings
from ...database import get_db
from ...models import ProviderAccount, User
from ...providers import get_provider
from ...schemas import AccountOut, GoogleClientOut
from ...services.tokens import save_tokens

router = APIRouter(prefix="/auth", tags=["auth"])


async def _find_or_create_user(db: AsyncSession, email: str) -> User:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(email=email, name=email.split("@")[0])
        db.add(user)
        await db.flush()
    return user


@router.get("/{provider}/login")
async def login(
    provider: str,
    request: Request,
    client: str = Query(None, description="Google OAuth client name (default|sancor)"),
):
    state = secrets.token_urlsafe(32)
    request.session["oauth_state"] = state
    request.session["oauth_provider"] = provider
    if provider == "google":
        request.session["oauth_google_client"] = client or "default"
        from ...providers import get_google_client

        provider_client = get_google_client(client or "default")
    else:
        provider_client = get_provider(provider)
    return RedirectResponse(provider_client.auth_url(state))


@router.get("/{provider}/callback")
async def callback(
    provider: str,
    request: Request,
    code: str | None = Query(None),
    error: str | None = Query(None),
    state: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    if error:
        raise HTTPException(status_code=400, detail=f"OAuth error: {error}")
    if code is None:
        raise HTTPException(status_code=400, detail="Missing authorization code")
    if state != request.session.get("oauth_state"):
        raise HTTPException(status_code=400, detail="State mismatch")

    if provider == "google":
        from ...providers import get_google_client

        client_name = request.session.get("oauth_google_client") or "default"
        provider_client = get_google_client(client_name)
    else:
        provider_client = get_provider(provider)
    bundle = await provider_client.exchange_code(code)

    # email may be in token claims; if absent, we need a minimal placeholder.
    # The user can be matched later via the account email.
    result = await db.execute(
        select(ProviderAccount).where(
            ProviderAccount.provider == provider,
            ProviderAccount.provider_email == bundle.email,
        )
    )
    account = result.scalar_one_or_none()
    if account is not None:
        user = await db.get(User, account.user_id)
    else:
        user = await _find_or_create_user(
            db, bundle.email or f"{provider}-{secrets.token_hex(4)}@local"
        )
        await db.flush()
        client_name = request.session.get("oauth_google_client") if provider == "google" else None
        account = await save_tokens(db, user.id, provider, bundle, client_name=client_name)
        user = await db.get(User, account.user_id)

    request.session.pop("oauth_state", None)
    return {
        "user": user.email,
        "provider": provider,
        "linked": True,
    }


@router.get("/accounts", response_model=list[AccountOut])
async def list_accounts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ProviderAccount))
    return [AccountOut.model_validate(acc) for acc in result.scalars().all()]


@router.get("/google/clients", response_model=list[GoogleClientOut])
async def google_clients():
    from ...providers import get_google_client_names

    return get_google_client_names()


@router.delete("/accounts/{account_id}")
async def delete_account(account_id: int, db: AsyncSession = Depends(get_db)):
    account = await db.get(ProviderAccount, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    await db.delete(account)
    await db.commit()
    return {"deleted": account_id}


@router.post("/sync/ics")
async def sync_ics(db: AsyncSession = Depends(get_db)):
    """Pull events from the published Outlook ICS calendar (no OAuth needed)."""
    from ...services.sync import sync_ics_calendar

    return await sync_ics_calendar(db)


@router.post("/refresh")
async def force_refresh(db: AsyncSession = Depends(get_db)):
    """Manually trigger a full sync of all linked accounts."""
    from ...services.sync import sync_user

    result = await db.execute(select(ProviderAccount))
    accounts = result.scalars().all()
    results = []
    for acc in accounts:
        results.append(await sync_user(db, acc.user_id))
    return {"synced": results}