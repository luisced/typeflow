from datetime import datetime, timezone
from typing import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import StaticPool


class Base(DeclarativeBase):
    pass


def _engine_kwargs(url: str) -> dict:
    # In-memory SQLite (tests/dev) needs a single shared connection.
    if url.startswith("sqlite") and (":memory:" in url or url.endswith("://")):
        return {"poolclass": StaticPool, "connect_args": {"check_same_thread": False}}
    if url.startswith("sqlite"):
        return {}
    return {"pool_pre_ping": True, "pool_recycle": 1800}


from app.core.config import settings  # noqa: E402

engine = create_async_engine(settings.database_url, **_engine_kwargs(settings.database_url))
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(dt: datetime) -> datetime:
    """SQLite returns naive datetimes; normalize before comparing."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)
