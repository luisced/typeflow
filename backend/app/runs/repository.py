import uuid
from collections.abc import Sequence

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.runs.models import Run


def _apply_filters(
    q,
    *,
    keyboard_id: uuid.UUID | None = None,
    layout: str | None = None,
):
    if keyboard_id is not None:
        q = q.where(Run.keyboard_id == keyboard_id)
    if layout is not None:
        q = q.where(Run.keyboard_layout == layout)
    return q


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
    db: AsyncSession,
    user_id: uuid.UUID,
    after: int,
    limit: int,
    *,
    keyboard_id: uuid.UUID | None = None,
    layout: str | None = None,
) -> list[Run]:
    q = select(Run).where(Run.user_id == user_id, Run.seq > after)
    q = _apply_filters(q, keyboard_id=keyboard_id, layout=layout)
    rows = await db.scalars(q.order_by(Run.seq).limit(limit))
    return list(rows)


async def get_by_client_id(
    db: AsyncSession, user_id: uuid.UUID, client_id: str
) -> Run | None:
    return await db.scalar(
        select(Run).where(Run.user_id == user_id, Run.client_id == client_id)
    )


async def delete_all_for_user(db: AsyncSession, user_id: uuid.UUID) -> None:
    await db.execute(delete(Run).where(Run.user_id == user_id))


async def all_for_user(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    keyboard_id: uuid.UUID | None = None,
    layout: str | None = None,
) -> list[Run]:
    q = select(Run).where(Run.user_id == user_id)
    q = _apply_filters(q, keyboard_id=keyboard_id, layout=layout)
    rows = await db.scalars(q.order_by(Run.finished_at.asc()))
    return list(rows)
