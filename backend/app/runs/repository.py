import uuid
from collections.abc import Sequence

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.runs.models import Run


async def existing_client_ids(
    db: AsyncSession, user_id: uuid.UUID, client_ids: Sequence[str]
) -> set[str]:
    if not client_ids:
        return set()
    rows = await db.scalars(
        select(Run.client_id).where(
            Run.user_id == user_id, Run.client_id.in_(client_ids)
        )
    )
    return set(rows)


async def page_after(
    db: AsyncSession, user_id: uuid.UUID, after: int, limit: int
) -> list[Run]:
    rows = await db.scalars(
        select(Run)
        .where(Run.user_id == user_id, Run.seq > after)
        .order_by(Run.seq)
        .limit(limit)
    )
    return list(rows)


async def get_by_client_id(
    db: AsyncSession, user_id: uuid.UUID, client_id: str
) -> Run | None:
    return await db.scalar(
        select(Run).where(Run.user_id == user_id, Run.client_id == client_id)
    )


async def delete_all_for_user(db: AsyncSession, user_id: uuid.UUID) -> None:
    await db.execute(delete(Run).where(Run.user_id == user_id))


async def all_for_user(db: AsyncSession, user_id: uuid.UUID) -> list[Run]:
    rows = await db.scalars(
        select(Run).where(Run.user_id == user_id).order_by(Run.finished_at.asc())
    )
    return list(rows)
