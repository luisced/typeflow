from typing import Any, Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field

MAX_BATCH = 500


class ContentFlagsIn(BaseModel):
    punctuation: bool = False
    numbers: bool = False
    capitals: bool = False


class PracticeMetaIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    target_keys: list[str] | None = Field(default=None, alias="targetKeys")


class GhostMetaIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    reference_run_id: str | None = Field(default=None, alias="referenceRunId")
    reference_wpm: int | None = Field(default=None, alias="referenceWpm")


class RunIn(BaseModel):
    """Mirrors the client's RunRecord (camelCase via aliases)."""

    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(min_length=1, max_length=64)
    mode: Literal["time", "words", "quote", "practice"]
    value: int = Field(ge=0, le=100_000)
    wpm: int = Field(ge=0, le=1_000)
    raw: int = Field(ge=0, le=2_000)
    accuracy: int = Field(ge=0, le=100)
    consistency: int = Field(ge=0, le=100)
    duration_sec: float = Field(alias="durationSec", ge=0, le=86_400)
    date: int = Field(ge=0)  # ms epoch, client clock
    error_map: dict[str, int] = Field(alias="errorMap", default_factory=dict)
    key_map: dict[str, int] = Field(alias="keyMap", default_factory=dict)
    samples: list[int] = Field(default_factory=list, max_length=86_400)
    raw_samples: list[int] = Field(
        alias="rawSamples", default_factory=list, max_length=86_400
    )
    error_seconds: list[int] = Field(
        alias="errorSeconds", default_factory=list, max_length=86_400
    )
    key_log: list[dict[str, Any]] = Field(
        alias="keyLog", default_factory=list, max_length=20_000
    )
    words: list[str] = Field(default_factory=list, max_length=10_000)
    keyboard_id: uuid.UUID | None = Field(default=None, alias="keyboardId")
    flags_key: str | None = Field(default=None, alias="flagsKey", max_length=32)
    flags: ContentFlagsIn | None = None
    practice: PracticeMetaIn | None = None
    ghost: GhostMetaIn | None = None
    is_comparable: bool | None = Field(default=None, alias="isComparable")
    # BCP 47 code of the content typed; absent means "en" (legacy runs)
    language: str | None = Field(default=None, max_length=16)


class RunOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    mode: str
    value: int
    wpm: int
    raw: int
    accuracy: int
    consistency: int
    duration_sec: float = Field(serialization_alias="durationSec")
    date: int
    error_map: dict[str, int] = Field(serialization_alias="errorMap")
    key_map: dict[str, int] = Field(serialization_alias="keyMap")
    samples: list[int]
    raw_samples: list[int] = Field(default_factory=list, serialization_alias="rawSamples")
    error_seconds: list[int] = Field(
        default_factory=list, serialization_alias="errorSeconds"
    )
    key_log: list[dict[str, Any]] = Field(
        default_factory=list, serialization_alias="keyLog"
    )
    words: list[str] = Field(default_factory=list)
    seq: int
    keyboard_id: uuid.UUID | None = Field(
        default=None, serialization_alias="keyboardId"
    )
    keyboard_name: str | None = Field(
        default=None, serialization_alias="keyboardName"
    )
    keyboard_layout: str | None = Field(
        default=None, serialization_alias="keyboardLayout"
    )
    flags_key: str | None = Field(default=None, serialization_alias="flagsKey")
    flags: ContentFlagsIn | None = None
    practice: PracticeMetaIn | None = None
    ghost: GhostMetaIn | None = None
    is_comparable: bool | None = Field(
        default=None, serialization_alias="isComparable"
    )
    language: str | None = None


class BatchIn(BaseModel):
    runs: list[RunIn] = Field(max_length=MAX_BATCH)


class BatchOut(BaseModel):
    accepted: list[str]
    skipped: list[str]


class RunSummaryOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    mode: str
    value: int
    wpm: int
    accuracy: int
    consistency: int
    duration_sec: float = Field(serialization_alias="durationSec")
    date: int
    keyboard_id: uuid.UUID | None = Field(
        default=None, serialization_alias="keyboardId"
    )
    keyboard_name: str | None = Field(
        default=None, serialization_alias="keyboardName"
    )
    keyboard_layout: str | None = Field(
        default=None, serialization_alias="keyboardLayout"
    )
    flags_key: str | None = Field(default=None, serialization_alias="flagsKey")


class SummaryPage(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    runs: list[RunSummaryOut]
    next_after: int = Field(serialization_alias="nextAfter")
    clear_epoch: int = Field(serialization_alias="clearEpoch")


class SyncPage(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    runs: list[RunOut]
    next_after: int = Field(serialization_alias="nextAfter")
    clear_epoch: int = Field(serialization_alias="clearEpoch")  # ms epoch


class ProfileSummaryOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    best_wpm: int = Field(serialization_alias="bestWpm")
    avg_wpm: int = Field(serialization_alias="avgWpm")
    avg_accuracy: int = Field(serialization_alias="avgAccuracy")
    total_runs: int = Field(serialization_alias="totalRuns")
    total_time_sec: float = Field(serialization_alias="totalTimeSec")


class DailyStatOut(BaseModel):
    date: str  # YYYY-MM-DD
    avg_wpm: int = Field(serialization_alias="avgWpm")
    run_count: int = Field(serialization_alias="runCount")


class WpmHistoryPointOut(BaseModel):
    finished_at: str = Field(serialization_alias="finishedAt")
    wpm: int


class ProfileStatsOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    summary: ProfileSummaryOut
    daily_stats: list[DailyStatOut] = Field(serialization_alias="dailyStats")
    wpm_history: list[WpmHistoryPointOut] = Field(serialization_alias="wpmHistory")
    key_accuracy: dict[str, int] = Field(serialization_alias="keyAccuracy")
    key_trends: dict[str, list[int]] = Field(serialization_alias="keyTrends")


class PublicUserOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    username: str
    display_name: str = Field(serialization_alias="displayName")


class LeaderboardEntry(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    rank: int
    username: str
    display_name: str = Field(serialization_alias="displayName")
    wpm: int
    accuracy: int
    score: float
    date: int


class LeaderboardOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    entries: list[LeaderboardEntry]
    your_entry: LeaderboardEntry | None = Field(
        default=None, serialization_alias="yourEntry"
    )
