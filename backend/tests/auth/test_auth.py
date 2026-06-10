from tests.conftest import register_payload, register_user

REFRESH_COOKIE = "typeflow_refresh"


async def test_register_returns_tokens_and_cookie(client):
    headers, data = await register_user(client)
    assert data["user"]["email"] == "luis@example.com"
    assert data["user"]["username"] == "luis"
    assert data["user"]["display_name"] == "Luis"
    assert data["token_type"] == "bearer"
    assert client.cookies.get(REFRESH_COOKIE)

    me = await client.get("/me", headers=headers)
    assert me.status_code == 200
    body = me.json()
    assert body["email"] == "luis@example.com"
    assert body["username"] == "luis"
    assert body["display_name"] == "Luis"


async def test_register_normalizes_email_and_rejects_duplicates(client):
    await register_user(client, "Luis@Example.com")
    res = await client.post(
        "/auth/register",
        json=register_payload("luis@example.com", username="other"),
    )
    assert res.status_code == 409


async def test_register_normalizes_username_and_rejects_duplicates(client):
    await register_user(client, username="Luis_Ced")
    res = await client.post(
        "/auth/register",
        json=register_payload("other@example.com", username="luis_ced"),
    )
    assert res.status_code == 409
    assert res.json()["detail"] == "Username already taken"


async def test_register_rejects_short_password(client):
    res = await client.post(
        "/auth/register",
        json=register_payload("a@b.com", username="abuser", password="short"),
    )
    assert res.status_code == 422


async def test_login_works_and_errors_are_generic(client):
    await register_user(client)

    # login by email
    ok_email = await client.post(
        "/auth/login",
        json={"identifier": "luis@example.com", "password": "hunter2hunter2"},
    )
    assert ok_email.status_code == 200
    assert ok_email.json()["access_token"]

    # login by username (register_user derives username from local part of email)
    ok_username = await client.post(
        "/auth/login",
        json={"identifier": "luis", "password": "hunter2hunter2"},
    )
    assert ok_username.status_code == 200
    assert ok_username.json()["access_token"]

    wrong_pw = await client.post(
        "/auth/login", json={"identifier": "luis@example.com", "password": "wrongwrong"}
    )
    unknown = await client.post(
        "/auth/login", json={"identifier": "nobody@example.com", "password": "wrongwrong"}
    )
    # same status, same body: no user enumeration
    assert wrong_pw.status_code == unknown.status_code == 401
    assert wrong_pw.json() == unknown.json()


async def test_refresh_rotates_token(client):
    await register_user(client)
    first_refresh = client.cookies.get(REFRESH_COOKIE)

    res = await client.post("/auth/refresh")
    assert res.status_code == 200
    assert res.json()["access_token"]
    assert client.cookies.get(REFRESH_COOKIE) != first_refresh


async def test_refresh_reuse_revokes_the_whole_chain(client):
    await register_user(client)
    stolen = client.cookies.get(REFRESH_COOKIE)

    # legitimate rotation happens...
    res = await client.post("/auth/refresh")
    assert res.status_code == 200
    current = client.cookies.get(REFRESH_COOKIE)

    # ...then the old (stolen) token is replayed
    client.cookies.clear()
    client.cookies.set(REFRESH_COOKIE, stolen, path="/auth")
    reuse = await client.post("/auth/refresh")
    assert reuse.status_code == 401

    # the current token is now dead too — every session was revoked
    client.cookies.clear()
    client.cookies.set(REFRESH_COOKIE, current, path="/auth")
    after = await client.post("/auth/refresh")
    assert after.status_code == 401


async def test_logout_revokes_refresh(client):
    await register_user(client)
    res = await client.post("/auth/logout")
    assert res.status_code == 204

    # cookie was cleared; even replaying the old value fails
    refresh = await client.post("/auth/refresh")
    assert refresh.status_code == 401


async def test_me_requires_auth(client):
    assert (await client.get("/me")).status_code == 401
    assert (
        await client.get("/me", headers={"Authorization": "Bearer not-a-jwt"})
    ).status_code == 401


async def test_delete_account_removes_everything(client, make_run):
    headers, _ = await register_user(client)
    await client.post("/runs/batch", json={"runs": [make_run()]}, headers=headers)
    assert client.cookies.get(REFRESH_COOKIE)

    res = await client.request("DELETE", "/me", headers=headers)
    assert res.status_code == 204
    assert REFRESH_COOKIE not in res.cookies or not res.cookies.get(REFRESH_COOKIE)

    # account is gone: token no longer resolves to a user
    assert (await client.get("/me", headers=headers)).status_code == 401

    # refresh cookie was cleared
    assert (await client.post("/auth/refresh")).status_code == 401

    # email is free again
    again = await client.post(
        "/auth/register",
        json=register_payload("luis@example.com"),
    )
    assert again.status_code == 201
