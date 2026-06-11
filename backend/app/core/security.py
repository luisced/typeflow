import hashlib
import secrets
import uuid
from datetime import timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings
from app.core.db import utcnow

_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except VerificationError:
        return False


def create_access_token(user_id: uuid.UUID) -> str:
    now = utcnow()
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_minutes),
        "type": "access",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> uuid.UUID | None:
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
        if payload.get("type") != "access":
            return None
        return uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


def new_refresh_token() -> tuple[str, str]:
    """Returns (raw, sha256-hash). Only the hash is ever stored."""
    raw = secrets.token_urlsafe(48)
    return raw, hash_token(raw)


def new_reset_token() -> tuple[str, str]:
    return new_refresh_token()


def hash_refresh_token(raw: str) -> str:
    return hash_token(raw)


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


_bearer = HTTPBearer(auto_error=False)

_unauthorized = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not authenticated",
    headers={"WWW-Authenticate": "Bearer"},
)


async def current_user_id(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> uuid.UUID:
    if creds is None:
        raise _unauthorized
    user_id = decode_access_token(creds.credentials)
    if user_id is None:
        raise _unauthorized
    return user_id


async def optional_user_id(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> uuid.UUID | None:
    if creds is None:
        return None
    return decode_access_token(creds.credentials)
