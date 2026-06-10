import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.keyboards.models import LAYOUTS

KeyboardLayout = Literal["qwerty", "dvorak", "colemak", "workman", "other"]


class KeyboardOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    name: str
    layout: KeyboardLayout
    is_active: bool = Field(serialization_alias="isActive")
    created_at: datetime = Field(serialization_alias="createdAt")


class KeyboardCreateIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=1, max_length=64)
    layout: KeyboardLayout

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        name = value.strip()
        if not name:
            raise ValueError("Name is required.")
        return name


class KeyboardUpdateIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str | None = Field(default=None, min_length=1, max_length=64)
    layout: KeyboardLayout | None = None
    is_active: bool | None = Field(default=None, alias="isActive")

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        name = value.strip()
        if not name:
            raise ValueError("Name is required.")
        return name

    @field_validator("layout")
    @classmethod
    def validate_layout(cls, value: str | None) -> str | None:
        if value is not None and value not in LAYOUTS:
            raise ValueError(f"Layout must be one of: {', '.join(sorted(LAYOUTS))}")
        return value
