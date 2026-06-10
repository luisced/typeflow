import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.keyboards.models import Keyboard


async def list_for_user(db: AsyncSession, user_id: uuid.UUID) -> list[Keyboard]:
    rows = await db.scalars(
        select(Keyboard)
        .where(Keyboard.user_id == user_id)
        .order_by(Keyboard.is_active.desc(), Keyboard.created_at.desc())
    )
    return list(rows)


async def get_by_id(
    db: AsyncSession, user_id: uuid.UUID, keyboard_id: uuid.UUID
) -> Keyboard | None:
    return await db.scalar(
        select(Keyboard).where(
            Keyboard.id == keyboard_id, Keyboard.user_id == user_id
        )
    )


async def get_active(db: AsyncSession, user_id: uuid.UUID) -> Keyboard | None:
    return await db.scalar(
        select(Keyboard).where(
            Keyboard.user_id == user_id, Keyboard.is_active.is_(True)
        )
    )


async def count_for_user(db: AsyncSession, user_id: uuid.UUID) -> int:
    rows = await db.scalars(
        select(Keyboard.id).where(Keyboard.user_id == user_id)
    )
    return len(list(rows))


async def deactivate_all(db: AsyncSession, user_id: uuid.UUID) -> None:
    await db.execute(
        update(Keyboard)
        .where(Keyboard.user_id == user_id, Keyboard.is_active.is_(True))
        .values(is_active=False)
    )


async def get_most_recent(
    db: AsyncSession, user_id: uuid.UUID, exclude_id: uuid.UUID | None = None
) -> Keyboard | None:
    q = select(Keyboard).where(Keyboard.user_id == user_id)
    if exclude_id is not None:
        q = q.where(Keyboard.id != exclude_id)
    q = q.order_by(Keyboard.created_at.desc()).limit(1)
    return await db.scalar(q)
