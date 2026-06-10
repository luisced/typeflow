import uuid

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import PasswordResetToken, RefreshToken, User
from app.core.db import utcnow


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    return await db.scalar(select(User).where(User.email == email))


async def get_user_by_username(db: AsyncSession, username: str) -> User | None:
    return await db.scalar(select(User).where(User.username == username))


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    return await db.get(User, user_id)


async def get_refresh_by_hash(db: AsyncSession, token_hash: str) -> RefreshToken | None:
    return await db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )


async def revoke_all_refresh_for_user(db: AsyncSession, user_id: uuid.UUID) -> None:
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=utcnow())
    )


async def delete_user_data(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Explicit deletes — portable across SQLite (tests) and Postgres."""
    from app.runs.models import Run

    await db.execute(delete(Run).where(Run.user_id == user_id))
    await db.execute(
        delete(PasswordResetToken).where(PasswordResetToken.user_id == user_id)
    )
    await db.execute(delete(RefreshToken).where(RefreshToken.user_id == user_id))
    await db.execute(delete(User).where(User.id == user_id))


async def get_reset_by_hash(
    db: AsyncSession, token_hash: str
) -> PasswordResetToken | None:
    return await db.scalar(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
    )


async def invalidate_reset_tokens_for_user(
    db: AsyncSession, user_id: uuid.UUID
) -> None:
    await db.execute(
        update(PasswordResetToken)
        .where(
            PasswordResetToken.user_id == user_id,
            PasswordResetToken.used_at.is_(None),
        )
        .values(used_at=utcnow())
    )
