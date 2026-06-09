from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

MAX_BATCH = 500


class RunIn(BaseModel):
    """Mirrors the client's RunRecord (camelCase via aliases)."""

    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(min_length=1, max_length=64)
    mode: Literal["time", "words", "quote"]
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
    seq: int


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
