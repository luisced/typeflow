import uuid
from unittest.mock import AsyncMock

import pytest

from app.auth.service import issue_reset_token
from app.core.db import SessionLocal
from tests.conftest import register_user

REFRESH_COOKIE = "typeflow_refresh"

PASSWORD = "hunter2hunter2"
NEW_PASSWORD = "newpassword99"


async def test_forgot_password_always_returns_202(client):
    await register_user(client)
    known = await client.post(
        "/auth/forgot-password", json={"email": "luis@example.com"}
    )
    unknown = await client.post(
        "/auth/forgot-password", json={"email": "ghost@example.com"}
    )
    assert known.status_code == unknown.status_code == 202


async def test_reset_password_with_valid_token(client):
    _, data = await register_user(client)
    user_id = uuid.UUID(data["user"]["id"])

    async with SessionLocal() as db:
        token = await issue_reset_token(db, user_id)
        await db.commit()

    res = await client.post(
        "/auth/reset-password",
        json={"token": token, "password": NEW_PASSWORD},
    )
    assert res.status_code == 204

    login_old = await client.post(
        "/auth/login",
        json={"identifier": "luis@example.com", "password": PASSWORD},
    )
    assert login_old.status_code == 401

    login_new = await client.post(
        "/auth/login",
        json={"identifier": "luis@example.com", "password": NEW_PASSWORD},
    )
    assert login_new.status_code == 200


async def test_reset_password_rejects_invalid_token(client):
    res = await client.post(
        "/auth/reset-password",
        json={"token": "not-a-real-token", "password": NEW_PASSWORD},
    )
    assert res.status_code == 400


async def test_reset_password_revokes_refresh_tokens(client):
    _, data = await register_user(client)
    user_id = uuid.UUID(data["user"]["id"])
    assert client.cookies.get(REFRESH_COOKIE)

    async with SessionLocal() as db:
        token = await issue_reset_token(db, user_id)
        await db.commit()

    res = await client.post(
        "/auth/reset-password",
        json={"token": token, "password": NEW_PASSWORD},
    )
    assert res.status_code == 204

    refresh = await client.post("/auth/refresh")
    assert refresh.status_code == 401


async def test_reset_password_rejects_reused_token(client):
    _, data = await register_user(client)
    user_id = uuid.UUID(data["user"]["id"])

    async with SessionLocal() as db:
        token = await issue_reset_token(db, user_id)
        await db.commit()

    first = await client.post(
        "/auth/reset-password",
        json={"token": token, "password": NEW_PASSWORD},
    )
    assert first.status_code == 204

    second = await client.post(
        "/auth/reset-password",
        json={"token": token, "password": "anotherpass99"},
    )
    assert second.status_code == 400


async def test_forgot_password_via_api_creates_resettable_token(client):
    await register_user(client)
    assert (
        await client.post(
            "/auth/forgot-password", json={"email": "luis@example.com"}
        )
    ).status_code == 202

    _, data = await register_user(client, "other@example.com", username="other")
    user_id = uuid.UUID(data["user"]["id"])
    async with SessionLocal() as db:
        token = await issue_reset_token(db, user_id)
        await db.commit()
    assert (
        await client.post(
            "/auth/reset-password",
            json={"token": token, "password": NEW_PASSWORD},
        )
    ).status_code == 204
