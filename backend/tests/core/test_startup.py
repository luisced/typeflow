import pytest
from unittest.mock import AsyncMock

from app.core import config
from app.core.startup import run_startup


async def test_run_startup_succeeds():
    await run_startup(version="0.1.0-test")


async def test_run_startup_rejects_weak_jwt_in_production(monkeypatch):
    monkeypatch.setattr(config.settings, "env", "production")
    monkeypatch.setattr(config.settings, "jwt_secret", "dev-secret-change-me")

    with pytest.raises(RuntimeError, match="jwt_secret"):
        await run_startup(version="0.1.0-test")

    monkeypatch.setattr(config.settings, "env", "development")


async def test_run_startup_fails_when_database_unreachable(monkeypatch):
    monkeypatch.setattr(
        "app.core.startup._ping_database",
        AsyncMock(side_effect=RuntimeError("connection refused")),
    )

    with pytest.raises(RuntimeError, match="database unreachable"):
        await run_startup(version="0.1.0-test")
