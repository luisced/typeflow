import time
import uuid
from dataclasses import dataclass
from datetime import timedelta
from typing import Literal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.core.db import as_utc, utcnow
from app.runs.models import Run
from app.runs.schemas import LeaderboardEntry, LeaderboardOut

FEATURED_BUCKETS: frozenset[tuple[str, int]] = frozenset(
    {("time", 15), ("time", 30), ("time", 60), ("words", 25)}
)

CACHE_TTL = 300  # 5 minutes
TOP_N = 100

_cache: dict[tuple[str, int, str], tuple[float, list[LeaderboardEntry]]] = {}


@dataclass(frozen=True)
class _RankedRun:
    user_id: uuid.UUID
    username: str
    display_name: str
    wpm: int
    accuracy: int
    score: float
    date_ms: int


def _score(wpm: int, accuracy: int) -> float:
    return round(wpm * (accuracy / 100), 1)


def _run_flags_key(run: Run) -> str:
    detail = run.detail or {}
    return detail.get("flagsKey") or "base"


def _is_qualifying(run: Run) -> bool:
    if run.mode == "practice":
        return False
    detail = run.detail or {}
    if detail.get("isComparable", True) is False:
        return False
    # WPM is not comparable across languages; only English runs qualify
    # until per-language boards exist. Absent means English (legacy runs).
    if detail.get("language", "en") != "en":
        return False
    return _run_flags_key(run) == "base"


def _date_ms(run: Run) -> int:
    return int(as_utc(run.finished_at).timestamp() * 1000)


def _sort_key(item: _RankedRun) -> tuple[float, int, int, int]:
    return (-item.score, -item.wpm, -item.accuracy, item.date_ms)


def _to_entry(rank: int, item: _RankedRun) -> LeaderboardEntry:
    return LeaderboardEntry(
        rank=rank,
        username=item.username,
        display_name=item.display_name,
        wpm=item.wpm,
        accuracy=item.accuracy,
        score=item.score,
        date=item.date_ms,
    )


def _best_per_user(
    rows: list[tuple[Run, User]],
    *,
    monthly: bool,
) -> list[_RankedRun]:
    cutoff = utcnow() - timedelta(days=30) if monthly else None
    best: dict[uuid.UUID, _RankedRun] = {}

    for run, user in rows:
        if not _is_qualifying(run):
            continue
        if cutoff is not None and as_utc(run.finished_at) < cutoff:
            continue

        candidate = _RankedRun(
            user_id=user.id,
            username=user.username,
            display_name=user.display_name,
            wpm=run.wpm,
            accuracy=run.accuracy,
            score=_score(run.wpm, run.accuracy),
            date_ms=_date_ms(run),
        )
        prev = best.get(user.id)
        if prev is None or _sort_key(candidate) < _sort_key(prev):
            best[user.id] = candidate

    return sorted(best.values(), key=_sort_key)


async def _fetch_bucket_rows(
    db: AsyncSession,
    mode: str,
    value: int,
) -> list[tuple[Run, User]]:
    rows = await db.execute(
        select(Run, User)
        .join(User, Run.user_id == User.id)
        .where(Run.mode == mode, Run.value == value)
    )
    return list(rows.all())


def _cache_key(mode: str, value: int, timeframe: str) -> tuple[str, int, str]:
    return (mode, value, timeframe)


def clear_cache() -> None:
    _cache.clear()


async def _build_ranked(
    db: AsyncSession,
    mode: str,
    value: int,
    timeframe: Literal["all_time", "monthly"],
) -> list[LeaderboardEntry]:
    key = _cache_key(mode, value, timeframe)
    now = time.monotonic()
    cached = _cache.get(key)
    if cached is not None and now - cached[0] < CACHE_TTL:
        return cached[1]

    rows = await _fetch_bucket_rows(db, mode, value)
    ranked = _best_per_user(rows, monthly=timeframe == "monthly")
    entries = [_to_entry(i + 1, item) for i, item in enumerate(ranked)]

    _cache[key] = (now, entries)
    return entries


def _find_user_entry(
    all_entries: list[LeaderboardEntry],
    top: list[LeaderboardEntry],
    item: _RankedRun,
) -> LeaderboardEntry | None:
    rank = next(
        (i + 1 for i, e in enumerate(all_entries) if e.username == item.username),
        None,
    )
    if rank is None:
        return None

    entry = _to_entry(rank, item)
    in_top = rank <= TOP_N
    if in_top:
        return next((e for e in top if e.username == item.username), entry)
    return entry


async def get_leaderboard(
    db: AsyncSession,
    mode: Literal["time", "words"],
    value: int,
    timeframe: Literal["all_time", "monthly"] = "all_time",
    user_id: uuid.UUID | None = None,
) -> LeaderboardOut:
    if (mode, value) not in FEATURED_BUCKETS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported leaderboard bucket",
        )

    all_entries = await _build_ranked(db, mode, value, timeframe)
    top = all_entries[:TOP_N]

    your_entry: LeaderboardEntry | None = None
    if user_id is not None:
        rows = await _fetch_bucket_rows(db, mode, value)
        user_rows = [(r, u) for r, u in rows if u.id == user_id]
        user_ranked = _best_per_user(user_rows, monthly=timeframe == "monthly")
        if user_ranked:
            entry = _find_user_entry(all_entries, top, user_ranked[0])
            if entry is not None and entry.rank > TOP_N:
                your_entry = entry

    return LeaderboardOut(entries=top, your_entry=your_entry)
