import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    JSON,
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, utcnow

if TYPE_CHECKING:
    from app.keyboards.models import Keyboard


class Run(Base):
    __tablename__ = "runs"
    __table_args__ = (
        UniqueConstraint("user_id", "client_id", name="uq_runs_user_client"),
        Index("runs_user_seq", "user_id", "seq"),
    )

    # global insert order = per-user sync cursor (filtered by user_id)
    seq: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"),
        primary_key=True,
        autoincrement=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    client_id: Mapped[str] = mapped_column(String(64))
    mode: Mapped[str] = mapped_column(String(16))
    value: Mapped[int] = mapped_column(Integer)
    wpm: Mapped[int] = mapped_column(Integer)
    raw: Mapped[int] = mapped_column(Integer)
    accuracy: Mapped[int] = mapped_column(Integer)
    consistency: Mapped[int] = mapped_column(Integer)
    duration_sec: Mapped[float] = mapped_column(
        Numeric(6, 1).with_variant(Integer, "sqlite")
    )
    finished_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    keyboard_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("keyboards.id", ondelete="SET NULL"), default=None, index=True
    )
    keyboard_layout: Mapped[str | None] = mapped_column(String(16), default=None)
    keyboard: Mapped["Keyboard | None"] = relationship("Keyboard", lazy="selectin")
    # bulky per-run arrays: { errorMap, samples } (+ charAttempts later)
    detail: Mapped[dict] = mapped_column(JSON().with_variant(JSONB, "postgresql"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
