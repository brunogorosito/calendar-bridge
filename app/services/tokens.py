from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import ProviderAccount
from ..providers import TokenBundle, get_provider


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def get_valid_token(db: AsyncSession, account: ProviderAccount) -> str:
    """Return a valid access token, refreshing and persisting it if expired."""
    if account.token_expires_at and account.token_expires_at > _utcnow():
        return account.access_token

    from ..providers import get_google_client, get_provider

    if account.provider == "google":
        provider = get_google_client(account.client_name or "default")
    else:
        provider = get_provider(account.provider)
    bundle: TokenBundle = await provider.refresh(account.refresh_token)
    account.access_token = bundle.access_token
    account.refresh_token = bundle.refresh_token or account.refresh_token
    account.token_expires_at = bundle.expires_at
    account.scopes = bundle.scopes
    if bundle.email:
        account.provider_email = bundle.email
    await db.commit()
    return account.access_token


async def save_tokens(
    db: AsyncSession, user_id: int, provider: str, bundle: TokenBundle, *, client_name: str | None = None
) -> ProviderAccount:
    # Match by provider + email so multiple accounts per provider are supported.
    result = await db.execute(
        select(ProviderAccount).where(
            ProviderAccount.provider == provider,
            ProviderAccount.provider_email == bundle.email,
        )
    )
    account = result.scalar_one_or_none()
    if account is None:
        account = ProviderAccount(user_id=user_id, provider=provider)
        db.add(account)
    if provider == "google":
        account.client_name = client_name or account.client_name or "default"
    account.provider_email = bundle.email
    account.access_token = bundle.access_token
    account.refresh_token = bundle.refresh_token or account.refresh_token
    account.token_expires_at = bundle.expires_at
    account.scopes = bundle.scopes
    await db.commit()
    await db.refresh(account)
    return account