import os

# must be set before anything under app/ is imported
os.environ["TYPEFLOW_DATABASE_URL"] = "sqlite+aiosqlite://"
os.environ["TYPEFLOW_RATE_LIMIT_ENABLED"] = "false"
os.environ["TYPEFLOW_COOKIE_SECURE"] = "false"
os.environ["TYPEFLOW_ENV"] = "development"

os.environ["TYPEFLOW_JWT_SECRET"] = "test-secret-with-at-least-32-bytes-ok!"

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.db import Base, engine
from app.core.ratelimit import limiter
from app.main import app  # noqa: E402  (imports models via routers)


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    limiter.enabled = False
    limiter.reset()
    yield
    limiter.enabled = False
    limiter.reset()


@pytest.fixture(autouse=True)
async def fresh_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
def make_run():
    """Factory for client-side RunRecord payloads."""

    def _make(id: str = "run-1", date: int | None = None, **overrides):
        run = {
            "id": id,
            "mode": "time",
            "value": 30,
            "wpm": 72,
            "raw": 78,
            "accuracy": 95,
            "consistency": 81,
            "durationSec": 30.0,
            "date": date if date is not None else 1_750_000_000_000,
            "errorMap": {"a": 2, "·": 1},
            "keyMap": {},
            "samples": [60, 70, 75],
        }
        run.update(overrides)
        return run

    return _make


def default_username(email: str) -> str:
    local = email.split("@")[0].replace(".", "_").lower()
    if len(local) >= 3:
        return local[:32]
    return f"user_{local}"[:32]


def register_payload(
    email: str = "luis@example.com",
    *,
    username: str | None = None,
    display_name: str = "Luis",
    password: str = "hunter2hunter2",
) -> dict[str, str]:
    return {
        "email": email,
        "username": username or default_username(email),
        "display_name": display_name,
        "password": password,
    }


async def register_user(
    client: AsyncClient,
    email: str = "luis@example.com",
    *,
    username: str | None = None,
    display_name: str = "Luis",
):
    """Registers and returns (auth_headers, response_json)."""
    res = await client.post(
        "/auth/register",
        json=register_payload(
            email, username=username, display_name=display_name
        ),
    )
    assert res.status_code == 201, res.text
    data = res.json()
    return {"Authorization": f"Bearer {data['access_token']}"}, data
