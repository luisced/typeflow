import time
from datetime import datetime, timedelta, timezone

from app.runs import leaderboard
from tests.conftest import register_user


async def test_leaderboard_public_no_auth(client, make_run):
    headers_a, data_a = await register_user(
        client, "a@example.com", username="alice", display_name="Alice"
    )
    headers_b, _ = await register_user(
        client, "b@example.com", username="bob", display_name="Bob"
    )

    await client.post(
        "/runs/batch",
        json={
            "runs": [
                make_run(id="a-1", wpm=100, accuracy=90),
            ]
        },
        headers=headers_a,
    )
    await client.post(
        "/runs/batch",
        json={
            "runs": [
                make_run(id="b-1", wpm=80, accuracy=100),
            ]
        },
        headers=headers_b,
    )

    leaderboard.clear_cache()
    res = await client.get("/runs/leaderboard?mode=time&value=30")
    assert res.status_code == 200
    data = res.json()
    assert len(data["entries"]) == 2
    assert data["entries"][0]["username"] == "alice"
    assert data["entries"][0]["score"] == 90.0
    assert data["entries"][1]["username"] == "bob"
    assert data["entries"][1]["score"] == 80.0
    assert data["yourEntry"] is None

    res_auth = await client.get(
        "/runs/leaderboard?mode=time&value=30", headers=headers_a
    )
    assert res_auth.status_code == 200
    assert res_auth.json()["yourEntry"] is None


async def test_leaderboard_pins_user_outside_top_100(client, make_run):
    leaderboard.clear_cache()
    users = []
    for i in range(101):
        headers, _ = await register_user(
            client,
            f"user{i}@example.com",
            username=f"user{i:03d}",
            display_name=f"User {i}",
        )
        users.append(headers)
        wpm = 200 - i
        await client.post(
            "/runs/batch",
            json={"runs": [make_run(id=f"run-{i}", wpm=wpm, accuracy=100)]},
            headers=headers,
        )

    outsider = users[100]
    res = await client.get(
        "/runs/leaderboard?mode=time&value=30", headers=outsider
    )
    data = res.json()
    assert len(data["entries"]) == 100
    assert data["yourEntry"] is not None
    assert data["yourEntry"]["rank"] == 101
    assert data["yourEntry"]["username"] == "user100"


async def test_leaderboard_tie_breaks_on_wpm(client, make_run):
    leaderboard.clear_cache()
    headers_a, _ = await register_user(
        client, "tie_a@example.com", username="tie_a", display_name="Tie A"
    )
    headers_b, _ = await register_user(
        client, "tie_b@example.com", username="tie_b", display_name="Tie B"
    )

    await client.post(
        "/runs/batch",
        json={"runs": [make_run(id="ta", wpm=90, accuracy=100)]},
        headers=headers_a,
    )
    await client.post(
        "/runs/batch",
        json={"runs": [make_run(id="tb", wpm=95, accuracy=94)]},
        headers=headers_b,
    )

    res = await client.get("/runs/leaderboard?mode=time&value=30")
    data = res.json()
    assert data["entries"][0]["username"] == "tie_a"
    assert data["entries"][0]["score"] == 90.0
    assert data["entries"][1]["username"] == "tie_b"
    assert data["entries"][1]["score"] == 89.3


async def test_leaderboard_excludes_practice_and_non_comparable(client, make_run):
    leaderboard.clear_cache()
    headers, _ = await register_user(client)
    runs = [
        make_run(id="ok", wpm=70),
        make_run(
            id="prac",
            mode="practice",
            wpm=200,
            isComparable=False,
            practice={"targetKeys": ["a"]},
        ),
        make_run(id="bad", wpm=150, isComparable=False),
        make_run(id="flags", wpm=160, flagsKey="c"),
    ]
    await client.post("/runs/batch", json={"runs": runs}, headers=headers)

    res = await client.get("/runs/leaderboard?mode=time&value=30")
    data = res.json()
    assert len(data["entries"]) == 1
    assert data["entries"][0]["wpm"] == 70


async def test_leaderboard_monthly_cutoff(client, make_run):
    leaderboard.clear_cache()
    headers, _ = await register_user(client)
    old_ms = int(
        (datetime.now(tz=timezone.utc) - timedelta(days=40)).timestamp() * 1000
    )
    recent_ms = int(
        (datetime.now(tz=timezone.utc) - timedelta(days=2)).timestamp() * 1000
    )
    runs = [
        make_run(id="old", wpm=120, date=old_ms),
        make_run(id="new", wpm=80, date=recent_ms),
    ]
    await client.post("/runs/batch", json={"runs": runs}, headers=headers)

    all_time = await client.get("/runs/leaderboard?mode=time&value=30")
    monthly = await client.get(
        "/runs/leaderboard?mode=time&value=30&timeframe=monthly"
    )
    assert all_time.json()["entries"][0]["wpm"] == 120
    assert monthly.json()["entries"][0]["wpm"] == 80


async def test_leaderboard_cache_returns_stale_within_ttl(client, make_run):
    leaderboard.clear_cache()
    headers_a, _ = await register_user(
        client, "cache_a@example.com", username="cache_a"
    )
    await client.post(
        "/runs/batch",
        json={"runs": [make_run(id="c1", wpm=50)]},
        headers=headers_a,
    )
    first = await client.get("/runs/leaderboard?mode=time&value=30")
    assert len(first.json()["entries"]) == 1

    headers_b, _ = await register_user(
        client, "cache_b@example.com", username="cache_b"
    )
    await client.post(
        "/runs/batch",
        json={"runs": [make_run(id="c2", wpm=99)]},
        headers=headers_b,
    )
    second = await client.get("/runs/leaderboard?mode=time&value=30")
    assert len(second.json()["entries"]) == 1

    leaderboard.clear_cache()
    third = await client.get("/runs/leaderboard?mode=time&value=30")
    assert len(third.json()["entries"]) == 2


async def test_leaderboard_rejects_unsupported_bucket(client):
    res = await client.get("/runs/leaderboard?mode=words&value=10")
    assert res.status_code == 400
