from tests.conftest import register_user


async def test_keyboards_require_auth(client):
    assert (await client.get("/me/keyboards")).status_code == 401
    assert (
        await client.post(
            "/me/keyboards", json={"name": "K2", "layout": "qwerty"}
        )
    ).status_code == 401


async def test_keyboard_crud_and_active_switching(client):
    headers, _ = await register_user(client)

    create = await client.post(
        "/me/keyboards",
        json={"name": "Keychron K2", "layout": "qwerty"},
        headers=headers,
    )
    assert create.status_code == 201
    kb1 = create.json()
    assert kb1["name"] == "Keychron K2"
    assert kb1["layout"] == "qwerty"
    assert kb1["isActive"] is True

    create2 = await client.post(
        "/me/keyboards",
        json={"name": "Laptop", "layout": "dvorak"},
        headers=headers,
    )
    assert create2.status_code == 201
    kb2 = create2.json()
    assert kb2["isActive"] is False

    listed = (await client.get("/me/keyboards", headers=headers)).json()
    assert len(listed) == 2
    assert listed[0]["isActive"] is True

    patch = await client.patch(
        f"/me/keyboards/{kb2['id']}",
        json={"isActive": True},
        headers=headers,
    )
    assert patch.status_code == 200
    assert patch.json()["isActive"] is True

    listed = (await client.get("/me/keyboards", headers=headers)).json()
    active = [k for k in listed if k["isActive"]]
    assert len(active) == 1
    assert active[0]["id"] == kb2["id"]

    delete = await client.delete(
        f"/me/keyboards/{kb2['id']}", headers=headers
    )
    assert delete.status_code == 204

    remaining = (await client.get("/me/keyboards", headers=headers)).json()
    assert len(remaining) == 1
    assert remaining[0]["id"] == kb1["id"]
    assert remaining[0]["isActive"] is True


async def test_cannot_access_other_users_keyboard(client):
    headers_a, _ = await register_user(client, "a@example.com")
    headers_b, _ = await register_user(client, "b@example.com")

    created = await client.post(
        "/me/keyboards",
        json={"name": "Mine", "layout": "qwerty"},
        headers=headers_a,
    )
    kb_id = created.json()["id"]

    assert (
        await client.patch(
            f"/me/keyboards/{kb_id}",
            json={"name": "Stolen"},
            headers=headers_b,
        )
    ).status_code == 404

    assert (
        await client.delete(f"/me/keyboards/{kb_id}", headers=headers_b)
    ).status_code == 404
