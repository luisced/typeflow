from tests.conftest import register_user


async def test_runs_require_auth(client, make_run):
    assert (await client.get("/runs")).status_code == 401
    assert (await client.get("/runs/summary")).status_code == 401
    assert (await client.get("/runs/run-1")).status_code == 401
    assert (
        await client.post("/runs/batch", json={"runs": [make_run()]})
    ).status_code == 401
    assert (await client.request("DELETE", "/runs")).status_code == 401


async def test_push_then_pull_roundtrip_includes_key_map(client, make_run):
    headers, _ = await register_user(client)
    run = make_run(id="keymap-1", keyMap={"a": 12, "s": 8, " ": 3})

    push = await client.post("/runs/batch", json={"runs": [run]}, headers=headers)
    assert push.status_code == 200

    pull = await client.get("/runs", headers=headers)
    [got] = pull.json()["runs"]
    assert got["keyMap"] == {"a": 12, "s": 8, " ": 3}


async def test_push_then_pull_roundtrip(client, make_run):
    headers, _ = await register_user(client)
    run = make_run(id="abc-123")

    push = await client.post("/runs/batch", json={"runs": [run]}, headers=headers)
    assert push.status_code == 200
    assert push.json() == {"accepted": ["abc-123"], "skipped": []}

    pull = await client.get("/runs", headers=headers)
    assert pull.status_code == 200
    page = pull.json()
    assert page["nextAfter"] > 0
    [got] = page["runs"]
    assert got["id"] == "abc-123"
    assert got["wpm"] == run["wpm"]
    assert got["durationSec"] == run["durationSec"]
    assert got["errorMap"] == run["errorMap"]
    assert got["samples"] == run["samples"]
    assert got["date"] == run["date"]


async def test_push_is_idempotent(client, make_run):
    headers, _ = await register_user(client)
    run = make_run(id="dup-1")

    first = await client.post("/runs/batch", json={"runs": [run]}, headers=headers)
    second = await client.post("/runs/batch", json={"runs": [run]}, headers=headers)
    assert first.json()["accepted"] == ["dup-1"]
    assert second.json() == {"accepted": [], "skipped": ["dup-1"]}

    # duplicates inside one batch are also collapsed
    batch = await client.post(
        "/runs/batch", json={"runs": [make_run(id="x"), make_run(id="x")]},
        headers=headers,
    )
    assert batch.json()["accepted"] == ["x"]

    page = (await client.get("/runs", headers=headers)).json()
    assert len(page["runs"]) == 2


async def test_cursor_pagination(client, make_run):
    headers, _ = await register_user(client)
    runs = [make_run(id=f"r-{i}", date=1_750_000_000_000 + i) for i in range(5)]
    await client.post("/runs/batch", json={"runs": runs}, headers=headers)

    first = (await client.get("/runs?limit=3", headers=headers)).json()
    assert [r["id"] for r in first["runs"]] == ["r-0", "r-1", "r-2"]

    rest = (
        await client.get(f"/runs?after={first['nextAfter']}", headers=headers)
    ).json()
    assert [r["id"] for r in rest["runs"]] == ["r-3", "r-4"]

    empty = (
        await client.get(f"/runs?after={rest['nextAfter']}", headers=headers)
    ).json()
    assert empty["runs"] == []
    assert empty["nextAfter"] == rest["nextAfter"]


async def test_summary_cursor_pagination(client, make_run):
    headers, _ = await register_user(client)
    runs = [make_run(id=f"s-{i}", date=1_750_000_000_000 + i) for i in range(5)]
    await client.post("/runs/batch", json={"runs": runs}, headers=headers)

    first = (await client.get("/runs/summary?limit=3", headers=headers)).json()
    assert [r["id"] for r in first["runs"]] == ["s-0", "s-1", "s-2"]

    rest = (
        await client.get(
            f"/runs/summary?after={first['nextAfter']}", headers=headers
        )
    ).json()
    assert [r["id"] for r in rest["runs"]] == ["s-3", "s-4"]

    empty = (
        await client.get(
            f"/runs/summary?after={rest['nextAfter']}", headers=headers
        )
    ).json()
    assert empty["runs"] == []
    assert empty["nextAfter"] == rest["nextAfter"]


async def test_users_are_isolated(client, make_run):
    headers_a, _ = await register_user(client, "a@example.com")
    headers_b, _ = await register_user(client, "b@example.com")

    await client.post(
        "/runs/batch", json={"runs": [make_run(id="a-run")]}, headers=headers_a
    )

    page_b = (await client.get("/runs", headers=headers_b)).json()
    assert page_b["runs"] == []


async def test_clear_history_sets_epoch_and_blocks_stale_pushes(client, make_run):
    headers, _ = await register_user(client)
    old_run = make_run(id="old", date=1_750_000_000_000)
    await client.post("/runs/batch", json={"runs": [old_run]}, headers=headers)

    res = await client.request("DELETE", "/runs", headers=headers)
    assert res.status_code == 204

    page = (await client.get("/runs", headers=headers)).json()
    assert page["runs"] == []
    assert page["clearEpoch"] > 0

    # a stale offline device re-pushing pre-clear runs gets silently dropped
    replay = await client.post(
        "/runs/batch", json={"runs": [old_run]}, headers=headers
    )
    assert replay.json() == {"accepted": [], "skipped": ["old"]}

    # runs finished after the clear sync normally
    new_run = make_run(id="new", date=page["clearEpoch"] + 60_000)
    fresh = await client.post(
        "/runs/batch", json={"runs": [new_run]}, headers=headers
    )
    assert fresh.json()["accepted"] == ["new"]


async def test_batch_rejects_more_than_500_runs(client, make_run):
    headers, _ = await register_user(client)
    runs = [make_run(id=f"run-{i}") for i in range(501)]
    res = await client.post("/runs/batch", json={"runs": runs}, headers=headers)
    assert res.status_code == 422


async def test_summary_omits_heavy_fields(client, make_run):
    headers, _ = await register_user(client)
    run = make_run(id="sum-1")
    await client.post("/runs/batch", json={"runs": [run]}, headers=headers)

    res = await client.get("/runs/summary", headers=headers)
    assert res.status_code == 200
    page = res.json()
    [got] = page["runs"]
    assert got["id"] == "sum-1"
    assert got["wpm"] == run["wpm"]
    assert "samples" not in got
    assert "errorMap" not in got


async def test_get_run_by_id_returns_full_record(client, make_run):
    headers, _ = await register_user(client)
    run = make_run(id="detail-1")
    await client.post("/runs/batch", json={"runs": [run]}, headers=headers)

    res = await client.get("/runs/detail-1", headers=headers)
    assert res.status_code == 200
    got = res.json()
    assert got["id"] == "detail-1"
    assert got["samples"] == run["samples"]
    assert got["errorMap"] == run["errorMap"]


async def test_get_run_by_id_is_isolated(client, make_run):
    headers_a, _ = await register_user(client, "a@example.com")
    headers_b, _ = await register_user(client, "b@example.com")
    await client.post(
        "/runs/batch", json={"runs": [make_run(id="private")]}, headers=headers_a
    )

    assert (
        await client.get("/runs/private", headers=headers_b)
    ).status_code == 404


async def test_push_then_pull_roundtrip_v2_metadata(client, make_run):
    headers, _ = await register_user(client)
    run = make_run(
        id="v2-1",
        mode="practice",
        flagsKey="c,n",
        flags={"capitals": True, "numbers": True, "punctuation": False},
        practice={"targetKeys": ["r", "th"]},
        ghost={"referenceRunId": "pb-1", "referenceWpm": 92},
        isComparable=False,
    )

    push = await client.post("/runs/batch", json={"runs": [run]}, headers=headers)
    assert push.status_code == 200

    pull = await client.get("/runs", headers=headers)
    [got] = pull.json()["runs"]
    assert got["mode"] == "practice"
    assert got["flagsKey"] == "c,n"
    assert got["flags"] == {
        "capitals": True,
        "numbers": True,
        "punctuation": False,
    }
    assert got["practice"] == {"targetKeys": ["r", "th"]}
    assert got["ghost"] == {"referenceRunId": "pb-1", "referenceWpm": 92}
    assert got["isComparable"] is False

    detail = await client.get("/runs/v2-1", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["flagsKey"] == "c,n"


async def test_summary_exposes_flags_key(client, make_run):
    headers, _ = await register_user(client)
    run = make_run(id="sum-flags", flagsKey="c,p")
    await client.post("/runs/batch", json={"runs": [run]}, headers=headers)

    res = await client.get("/runs/summary", headers=headers)
    [got] = res.json()["runs"]
    assert got["flagsKey"] == "c,p"


async def test_validation_rejects_garbage(client, make_run):
    headers, _ = await register_user(client)
    bad_mode = make_run()
    bad_mode["mode"] = "marathon"
    assert (
        await client.post("/runs/batch", json={"runs": [bad_mode]}, headers=headers)
    ).status_code == 422

    bad_wpm = make_run()
    bad_wpm["wpm"] = 99_999
    assert (
        await client.post("/runs/batch", json={"runs": [bad_wpm]}, headers=headers)
    ).status_code == 422
