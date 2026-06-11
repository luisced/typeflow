from tests.conftest import register_user


async def test_profile_stats_requires_auth(client):
    assert (await client.get("/runs/profile-stats")).status_code == 401


async def test_profile_stats_aggregates_runs(client, make_run):
    headers, _ = await register_user(client)
    runs = [
        make_run(
            id="p-1",
            wpm=100,
            accuracy=95,
            durationSec=60,
            date=1_750_000_000_000,
            errorMap={"t": 2},
            keyMap={"t": 20, "h": 30},
        ),
        make_run(
            id="p-2",
            wpm=120,
            accuracy=98,
            durationSec=45,
            date=1_750_086_400_000,
            errorMap={"t": 1},
            keyMap={"t": 15, "h": 25},
        ),
        make_run(
            id="p-3",
            wpm=80,
            accuracy=90,
            durationSec=30,
            date=1_750_000_000_000,
            errorMap={"g": 5},
            keyMap={},
        ),
    ]
    await client.post("/runs/batch", json={"runs": runs}, headers=headers)

    res = await client.get("/runs/profile-stats", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["summary"]["bestWpm"] == 120
    assert data["summary"]["avgAccuracy"] == 94
    assert data["summary"]["totalRuns"] == 3
    assert data["summary"]["totalTimeSec"] == 135
    assert len(data["dailyStats"]) >= 1
    assert len(data["wpmHistory"]) == 3
    wpms = [p["wpm"] for p in data["wpmHistory"]]
    assert wpms[-1] == 120
    assert sorted(wpms) == [80, 100, 120]
    assert data["keyAccuracy"]["t"] == 91
    assert "g" not in data["keyAccuracy"]
    assert len(data["keyTrends"]["t"]) == 2


async def test_profile_stats_excludes_practice_runs(client, make_run):
    headers, _ = await register_user(client)
    runs = [
        make_run(id="norm-1", wpm=100),
        make_run(
            id="prac-1",
            mode="practice",
            wpm=150,
            isComparable=False,
            practice={"targetKeys": ["r"]},
        ),
    ]
    await client.post("/runs/batch", json={"runs": runs}, headers=headers)

    res = await client.get("/runs/profile-stats", headers=headers)
    data = res.json()
    assert data["summary"]["totalRuns"] == 1
    assert data["summary"]["bestWpm"] == 100


async def test_profile_stats_filters_by_flags_key(client, make_run):
    headers, _ = await register_user(client)
    runs = [
        make_run(id="base-1", wpm=80, flagsKey="base"),
        make_run(id="caps-1", wpm=95, flagsKey="c"),
        make_run(id="both-1", wpm=110, flagsKey="c,n"),
    ]
    await client.post("/runs/batch", json={"runs": runs}, headers=headers)

    res = await client.get("/runs/profile-stats?flagsKey=c", headers=headers)
    data = res.json()
    assert data["summary"]["totalRuns"] == 1
    assert data["summary"]["bestWpm"] == 95
