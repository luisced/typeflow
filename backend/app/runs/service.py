import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from fastapi import HTTPException, status

from app.auth import repository as auth_repo
from app.core.db import as_utc, utcnow
from app.keyboards import service as kb_service
from app.runs import repository as repo
from app.runs.models import Run
from app.runs.schemas import (
    BatchOut,
    DailyStatOut,
    ProfileStatsOut,
    ProfileSummaryOut,
    RunIn,
    RunOut,
    RunSummaryOut,
    SummaryPage,
    SyncPage,
    WpmHistoryPointOut,
)


def _ms_to_dt(ms: int) -> datetime:
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc)


def _dt_to_ms(dt: datetime) -> int:
    return int(as_utc(dt).timestamp() * 1000)


def _keyboard_name(run: Run) -> str | None:
    if run.keyboard is not None:
        return run.keyboard.name
    return None


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
        keyboard_id=run.keyboard_id,
        keyboard_name=_keyboard_name(run),
        keyboard_layout=run.keyboard_layout,
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
        raw_samples=detail.get("rawSamples", []),
        error_seconds=detail.get("errorSeconds", []),
        key_log=detail.get("keyLog", []),
        words=detail.get("words", []),
        seq=run.seq,
        keyboard_id=run.keyboard_id,
        keyboard_name=_keyboard_name(run),
        keyboard_layout=run.keyboard_layout,
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

        keyboard = await kb_service.resolve_for_run(db, user_id, r.keyboard_id)
        keyboard_id = keyboard.id if keyboard else None
        keyboard_layout = keyboard.layout if keyboard else None

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
                detail={
                    "errorMap": r.error_map,
                    "keyMap": r.key_map,
                    "samples": r.samples,
                    "rawSamples": r.raw_samples,
                    "errorSeconds": r.error_seconds,
                    "keyLog": r.key_log,
                    "words": r.words,
                },
                keyboard_id=keyboard_id,
                keyboard_layout=keyboard_layout,
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
    db: AsyncSession,
    user_id: uuid.UUID,
    after: int,
    limit: int,
    *,
    keyboard_id: uuid.UUID | None = None,
    layout: str | None = None,
) -> SummaryPage:
    user = await auth_repo.get_user_by_id(db, user_id)
    rows = await repo.page_after(
        db, user_id, after, limit, keyboard_id=keyboard_id, layout=layout
    )
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


def _key_accuracy_for_run(
    error_map: dict[str, int], key_map: dict[str, int]
) -> dict[str, int]:
    out: dict[str, int] = {}
    for key, presses in key_map.items():
        if presses <= 0:
            continue
        errors = error_map.get(key, 0)
        out[key] = max(0, round(100 * (1 - errors / presses)))
    return out


async def profile_stats(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    keyboard_id: uuid.UUID | None = None,
    layout: str | None = None,
) -> ProfileStatsOut:
    runs = await repo.all_for_user(
        db, user_id, keyboard_id=keyboard_id, layout=layout
    )

    if not runs:
        return ProfileStatsOut(
            summary=ProfileSummaryOut(
                best_wpm=0,
                avg_wpm=0,
                avg_accuracy=0,
                total_runs=0,
                total_time_sec=0,
            ),
            daily_stats=[],
            wpm_history=[],
            key_accuracy={},
            key_trends={},
        )

    best_wpm = max(r.wpm for r in runs)
    avg_wpm = round(sum(r.wpm for r in runs) / len(runs))
    avg_accuracy = round(sum(r.accuracy for r in runs) / len(runs))
    total_time = sum(r.duration_sec for r in runs)

    daily: dict[str, list[int]] = defaultdict(list)
    cutoff = utcnow() - timedelta(days=365)
    for r in runs:
        if as_utc(r.finished_at) < cutoff:
            continue
        day = as_utc(r.finished_at).date().isoformat()
        daily[day].append(r.wpm)

    daily_stats = [
        DailyStatOut(
            date=day, avg_wpm=round(sum(wpms) / len(wpms)), run_count=len(wpms)
        )
        for day, wpms in sorted(daily.items())
    ]

    agg_errors: dict[str, int] = defaultdict(int)
    agg_presses: dict[str, int] = defaultdict(int)
    per_run_key_acc: list[tuple[datetime, dict[str, int]]] = []

    for r in runs:
        detail = r.detail or {}
        key_map = detail.get("keyMap") or {}
        if not key_map:
            continue
        error_map = detail.get("errorMap") or {}
        run_acc = _key_accuracy_for_run(error_map, key_map)
        per_run_key_acc.append((as_utc(r.finished_at), run_acc))
        for key, presses in key_map.items():
            agg_presses[key] += presses
            agg_errors[key] += error_map.get(key, 0)

    key_accuracy = {
        key: max(0, round(100 * (1 - agg_errors[key] / agg_presses[key])))
        for key in agg_presses
        if agg_presses[key] > 0
    }

    recent = per_run_key_acc[-50:]
    key_trends: dict[str, list[int]] = defaultdict(list)
    for _, run_acc in recent:
        for key, acc in run_acc.items():
            key_trends[key].append(acc)

    sorted_runs = sorted(runs, key=lambda r: as_utc(r.finished_at))
    wpm_history = [
        WpmHistoryPointOut(
            finished_at=as_utc(r.finished_at).isoformat(),
            wpm=r.wpm,
        )
        for r in sorted_runs[-100:]
    ]

    return ProfileStatsOut(
        summary=ProfileSummaryOut(
            best_wpm=best_wpm,
            avg_wpm=avg_wpm,
            avg_accuracy=avg_accuracy,
            total_runs=len(runs),
            total_time_sec=total_time,
        ),
        daily_stats=daily_stats,
        wpm_history=wpm_history,
        key_accuracy=dict(key_accuracy),
        key_trends={k: v for k, v in key_trends.items() if k in key_accuracy},
    )
