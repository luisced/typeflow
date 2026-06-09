import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from fastapi import HTTPException, status

from app.auth import repository as auth_repo
from app.core.db import as_utc, utcnow
from app.runs import repository as repo
from app.runs.models import Run
from app.runs.schemas import BatchOut, RunIn, RunOut, RunSummaryOut, SummaryPage, SyncPage


def _ms_to_dt(ms: int) -> datetime:
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc)


def _dt_to_ms(dt: datetime) -> int:
    return int(as_utc(dt).timestamp() * 1000)


def _to_summary(run: Run) -> RunSummaryOut:
    return RunSummaryOut(
        id=run.client_id,
        mode=run.mode,
        value=run.value,
        wpm=run.wpm,
        accuracy=run.accuracy,
        consistency=run.consistency,
        duration_sec=run.duration_sec,
        date=_dt_to_ms(run.finished_at),
    )


def _to_out(run: Run) -> RunOut:
    detail = run.detail or {}
    return RunOut(
        id=run.client_id,
        mode=run.mode,
        value=run.value,
        wpm=run.wpm,
        raw=run.raw,
        accuracy=run.accuracy,
        consistency=run.consistency,
        duration_sec=run.duration_sec,
        date=_dt_to_ms(run.finished_at),
        error_map=detail.get("errorMap", {}),
        key_map=detail.get("keyMap", {}),
        samples=detail.get("samples", []),
        seq=run.seq,
    )


async def push_batch(
    db: AsyncSession, user_id: uuid.UUID, runs: list[RunIn]
) -> BatchOut:
    user = await auth_repo.get_user_by_id(db, user_id)
    clear_epoch = as_utc(user.clear_epoch) if user else None

    # dedupe within the batch, then against what the server already has
    seen: dict[str, RunIn] = {}
    for r in runs:
        seen.setdefault(r.id, r)
    existing = await repo.existing_client_ids(db, user_id, list(seen.keys()))

    accepted: list[str] = []
    skipped: list[str] = []
    for client_id, r in seen.items():
        finished_at = _ms_to_dt(r.date)
        if client_id in existing:
            skipped.append(client_id)  # idempotent retry
            continue
        if clear_epoch is not None and finished_at <= clear_epoch:
            skipped.append(client_id)  # cleared history must stay cleared
            continue
        db.add(
            Run(
                user_id=user_id,
                client_id=client_id,
                mode=r.mode,
                value=r.value,
                wpm=r.wpm,
                raw=r.raw,
                accuracy=r.accuracy,
                consistency=r.consistency,
                duration_sec=r.duration_sec,
                finished_at=finished_at,
                detail={"errorMap": r.error_map, "keyMap": r.key_map, "samples": r.samples},
            )
        )
        accepted.append(client_id)

    await db.commit()
    return BatchOut(accepted=accepted, skipped=skipped)


async def pull_page(
    db: AsyncSession, user_id: uuid.UUID, after: int, limit: int
) -> SyncPage:
    user = await auth_repo.get_user_by_id(db, user_id)
    rows = await repo.page_after(db, user_id, after, limit)
    return SyncPage(
        runs=[_to_out(r) for r in rows],
        next_after=rows[-1].seq if rows else after,
        clear_epoch=_dt_to_ms(user.clear_epoch) if user else 0,
    )


async def summary_page(
    db: AsyncSession, user_id: uuid.UUID, after: int, limit: int
) -> SummaryPage:
    user = await auth_repo.get_user_by_id(db, user_id)
    rows = await repo.page_after(db, user_id, after, limit)
    return SummaryPage(
        runs=[_to_summary(r) for r in rows],
        next_after=rows[-1].seq if rows else after,
        clear_epoch=_dt_to_ms(user.clear_epoch) if user else 0,
    )


async def get_run(db: AsyncSession, user_id: uuid.UUID, client_id: str) -> RunOut:
    run = await repo.get_by_client_id(db, user_id, client_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return _to_out(run)


async def clear_history(db: AsyncSession, user_id: uuid.UUID) -> None:
    await repo.delete_all_for_user(db, user_id)
    user = await auth_repo.get_user_by_id(db, user_id)
    if user is not None:
        user.clear_epoch = utcnow()
    await db.commit()
