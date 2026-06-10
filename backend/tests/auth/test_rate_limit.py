import pytest
from httpx import ASGITransport, AsyncClient

from tests.conftest import register_payload

from app.core import config
from app.core.db import Base, engine
from app.core.ratelimit import limiter
from app.main import create_app


@pytest.fixture
async def limited_client():
    limiter.reset()
    config.settings.rate_limit_enabled = True
    limiter.enabled = True
    app = create_app()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

    config.settings.rate_limit_enabled = False


async def test_register_rate_limited_after_five_requests(limited_client):
    for i in range(5):
        res = await limited_client.post(
            "/auth/register",
            json=register_payload(
                f"user{i}@example.com",
                username=f"user{i}",
                display_name=f"User {i}",
            ),
        )
        assert res.status_code == 201, res.text

    blocked = await limited_client.post(
        "/auth/register",
        json=register_payload(
            "blocked@example.com",
            username="blocked",
            display_name="Blocked",
        ),
    )
    assert blocked.status_code == 429


async def test_login_rate_limited_after_five_requests(limited_client):
    for i in range(5):
        res = await limited_client.post(
            "/auth/login",
            json={"identifier": f"user{i}@example.com", "password": "wrongwrong"},
        )
        assert res.status_code == 401

    blocked = await limited_client.post(
        "/auth/login",
        json={"identifier": "blocked@example.com", "password": "wrongwrong"},
    )
    assert blocked.status_code == 429


async def test_refresh_rate_limited_after_thirty_requests(limited_client):
    await limited_client.post(
        "/auth/register",
        json=register_payload("refresh-limit@example.com", username="refreshlimit"),
    )

    for _ in range(30):
        res = await limited_client.post("/auth/refresh")
        assert res.status_code == 200, res.text

    blocked = await limited_client.post("/auth/refresh")
    assert blocked.status_code == 429
