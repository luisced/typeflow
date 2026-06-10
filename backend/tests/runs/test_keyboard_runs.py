from tests.conftest import register_user


async def _create_keyboard(client, headers, name, layout, active=False):
    res = await client.post(
        "/me/keyboards",
        json={"name": name, "layout": layout},
        headers=headers,
    )
    kb = res.json()
    if active and not kb["isActive"]:
        await client.patch(
            f"/me/keyboards/{kb['id']}",
            json={"isActive": True},
            headers=headers,
        )
    return kb


async def test_push_assigns_active_keyboard(client, make_run):
    headers, _ = await register_user(client)
    kb = await _create_keyboard(client, headers, "Desk", "qwerty", active=True)

    run = make_run(id="kb-run-1")
    push = await client.post("/runs/batch", json={"runs": [run]}, headers=headers)
    assert push.status_code == 200

    got = (await client.get("/runs/kb-run-1", headers=headers)).json()
    assert got["keyboardId"] == kb["id"]
    assert got["keyboardName"] == "Desk"
    assert got["keyboardLayout"] == "qwerty"


async def test_push_respects_explicit_keyboard_id(client, make_run):
    headers, _ = await register_user(client)
    kb1 = await _create_keyboard(client, headers, "Desk", "qwerty", active=True)
    kb2 = await _create_keyboard(client, headers, "Travel", "colemak")

    run = make_run(id="kb-run-2", keyboardId=kb2["id"])
    await client.post("/runs/batch", json={"runs": [run]}, headers=headers)

    got = (await client.get("/runs/kb-run-2", headers=headers)).json()
    assert got["keyboardId"] == kb2["id"]
    assert got["keyboardLayout"] == "colemak"


async def test_summary_filters_by_keyboard_and_layout(client, make_run):
    headers, _ = await register_user(client)
    kb_q = await _create_keyboard(client, headers, "Q Board", "qwerty", active=True)
    kb_d = await _create_keyboard(client, headers, "D Board", "dvorak")

    await client.post(
        "/runs/batch",
        json={"runs": [make_run(id="r-q", keyboardId=kb_q["id"])]},
        headers=headers,
    )
    await client.post(
        "/runs/batch",
        json={"runs": [make_run(id="r-d", keyboardId=kb_d["id"])]},
        headers=headers,
    )

    by_kb = (
        await client.get(
            f"/runs/summary?keyboardId={kb_q['id']}", headers=headers
        )
    ).json()
    assert [r["id"] for r in by_kb["runs"]] == ["r-q"]

    by_layout = (
        await client.get("/runs/summary?layout=dvorak", headers=headers)
    ).json()
    assert [r["id"] for r in by_layout["runs"]] == ["r-d"]

    all_runs = (await client.get("/runs/summary", headers=headers)).json()
    assert len(all_runs["runs"]) == 2


async def test_profile_stats_respects_filters(client, make_run):
    headers, _ = await register_user(client)

    await client.post(
        "/runs/batch",
        json={"runs": [make_run(id="slow", wpm=40)]},
        headers=headers,
    )

    kb = await _create_keyboard(client, headers, "Fast", "qwerty", active=True)

    await client.post(
        "/runs/batch",
        json={"runs": [make_run(id="fast", wpm=100, keyboardId=kb["id"])]},
        headers=headers,
    )

    filtered = (
        await client.get(
            f"/runs/profile-stats?keyboardId={kb['id']}", headers=headers
        )
    ).json()
    assert filtered["summary"]["totalRuns"] == 1
    assert filtered["summary"]["bestWpm"] == 100

    all_stats = (await client.get("/runs/profile-stats", headers=headers)).json()
    assert all_stats["summary"]["totalRuns"] == 2
