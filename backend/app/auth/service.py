import uuid
from datetime import timedelta

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import repository as repo
from app.auth.models import PasswordResetToken, RefreshToken, User
from app.core.config import settings
from app.core.db import as_utc, utcnow
from app.core.security import (
    create_access_token,
    hash_password,
    hash_refresh_token,
    hash_token,
    new_refresh_token,
    new_reset_token,
    verify_password,
)

_invalid_credentials = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
)


_invalid_reset = HTTPException(
    status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token"
)


async def register(
    db: AsyncSession,
    email: str,
    username: str,
    display_name: str,
    password: str,
) -> tuple[User, str, str]:
    email = email.strip().lower()
    username = username.strip().lower()
    display_name = display_name.strip()
    if await repo.get_user_by_email(db, email) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Email already registered"
        )
    if await repo.get_user_by_username(db, username) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Username already taken"
        )
    user = User(
        email=email,
        username=username,
        display_name=display_name,
        password_hash=hash_password(password),
    )
    db.add(user)
    await db.flush()
    access, refresh_raw = await _issue_pair(db, user.id)
    await db.commit()
    return user, access, refresh_raw


async def login(db: AsyncSession, identifier: str, password: str) -> tuple[User, str, str]:
    identifier = identifier.strip().lower()
    # email if it contains "@", otherwise treat as username
    if "@" in identifier:
        user = await repo.get_user_by_email(db, identifier)
    else:
        user = await repo.get_user_by_username(db, identifier)
    # same error for unknown identifier and wrong password — no enumeration
    if user is None or not verify_password(user.password_hash, password):
        raise _invalid_credentials
    access, refresh_raw = await _issue_pair(db, user.id)
    await db.commit()
    return user, access, refresh_raw


async def rotate_refresh(db: AsyncSession, raw: str) -> tuple[str, str]:
    token = await repo.get_refresh_by_hash(db, hash_refresh_token(raw))
    if token is None:
        raise _invalid_credentials
    now = utcnow()
    if (
        token.revoked_at is not None
        or token.replaced_by is not None
        or as_utc(token.expires_at) < now
    ):
        # reuse of a rotated/revoked token: assume theft, kill every session
        await repo.revoke_all_refresh_for_user(db, token.user_id)
        await db.commit()
        raise _invalid_credentials

    access, new_raw = await _issue_pair(db, token.user_id)
    new_hash = hash_refresh_token(new_raw)
    new_token = await repo.get_refresh_by_hash(db, new_hash)
    token.revoked_at = now
    token.replaced_by = new_token.id if new_token else None
    await db.commit()
    return access, new_raw


async def logout(db: AsyncSession, raw: str | None) -> None:
    if raw:
        token = await repo.get_refresh_by_hash(db, hash_refresh_token(raw))
        if token is not None and token.revoked_at is None:
            token.revoked_at = utcnow()
    await db.commit()


async def get_user(db: AsyncSession, user_id: uuid.UUID) -> User:
    user = await repo.get_user_by_id(db, user_id)
    if user is None:
        raise _invalid_credentials
    return user


async def delete_account(db: AsyncSession, user_id: uuid.UUID) -> None:
    await repo.delete_user_data(db, user_id)
    await db.commit()


async def request_password_reset(db: AsyncSession, email: str) -> None:
    email = email.strip().lower()
    user = await repo.get_user_by_email(db, email)
    if user is not None:
        await repo.invalidate_reset_tokens_for_user(db, user.id)
        await issue_reset_token(db, user.id)
        await db.commit()
    # Always succeed silently — no user enumeration.


async def reset_password(db: AsyncSession, raw_token: str, password: str) -> None:
    token = await repo.get_reset_by_hash(db, hash_token(raw_token))
    now = utcnow()
    if token is None or token.used_at is not None or as_utc(token.expires_at) < now:
        raise _invalid_reset

    user = await repo.get_user_by_id(db, token.user_id)
    if user is None:
        raise _invalid_reset

    user.password_hash = hash_password(password)
    token.used_at = now
    await repo.revoke_all_refresh_for_user(db, user.id)
    await db.commit()


async def issue_reset_token(db: AsyncSession, user_id: uuid.UUID) -> str:
    """Create a password reset token. Returns raw token (for tests / future email)."""
    raw, token_hash = new_reset_token()
    db.add(
        PasswordResetToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=utcnow() + timedelta(minutes=settings.password_reset_minutes),
        )
    )
    await db.flush()
    return raw


async def _issue_pair(db: AsyncSession, user_id: uuid.UUID) -> tuple[str, str]:
    raw, token_hash = new_refresh_token()
    db.add(
        RefreshToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=utcnow() + timedelta(days=settings.refresh_token_days),
        )
    )
    await db.flush()
    return create_access_token(user_id), raw
