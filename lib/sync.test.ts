// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setSession } from "./auth";
import { loadHistory, saveRun } from "./storage";
import type { RunRecord } from "./types";

const apiMocks = vi.hoisted(() => ({
  getAccessToken: vi.fn(() => "tok"),
  pushRuns: vi.fn(),
  pullRuns: vi.fn(),
}));

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return {
    ...actual,
    getAccessToken: apiMocks.getAccessToken,
    pushRuns: apiMocks.pushRuns,
    pullRuns: apiMocks.pullRuns,
  };
});

import {
  formatLastSyncedAt,
  getLastSyncedAt,
  getSyncStatus,
  pullAndMerge,
  pushPending,
  queueRun,
  syncNow,
} from "./sync";

function makeRun(id: string, date = 1_750_000_000_000): RunRecord {
  return {
    id,
    mode: "time",
    value: 30,
    wpm: 72,
    raw: 78,
    accuracy: 95,
    consistency: 81,
    durationSec: 30,
    date,
    errorMap: {},
    keyMap: {},
    samples: [60],
  };
}

beforeEach(() => {
  window.localStorage.clear();
  apiMocks.getAccessToken.mockReturnValue("tok");
  apiMocks.pushRuns.mockReset();
  apiMocks.pullRuns.mockReset();
  setSession({
    id: "u1",
    email: "a@b.com",
    username: "abuser",
    displayName: "AB User",
    createdAt: "2026-01-01T00:00:00Z",
  });
});

afterEach(() => {
  setSession(null);
});

describe("queueRun + pushPending", () => {
  it("pushes pending runs and clears accepted ids", async () => {
    saveRun(makeRun("run-1"));
    queueRun("run-1");

    apiMocks.pushRuns.mockResolvedValueOnce({
      accepted: ["run-1"],
      skipped: [],
    });

    await pushPending();
    expect(apiMocks.pushRuns).toHaveBeenCalledWith([
      expect.objectContaining({ id: "run-1" }),
    ]);
  });
});

describe("pullAndMerge", () => {
  it("merges pulled runs by id", async () => {
    window.localStorage.setItem(
      "typeflow.sync.v1",
      JSON.stringify({ lastPulledSeq: 0, pendingIds: [], clearEpoch: 0 })
    );

    apiMocks.pullRuns
      .mockResolvedValueOnce({
        runs: [{ ...makeRun("remote-1"), seq: 1 }],
        nextAfter: 1,
        clearEpoch: 0,
      })
      .mockResolvedValueOnce({
        runs: [],
        nextAfter: 1,
        clearEpoch: 0,
      });

    await pullAndMerge();
    expect(loadHistory().map((r) => r.id)).toContain("remote-1");
  });

  it("wipes local history when server clearEpoch advances", async () => {
    saveRun(makeRun("local-1"));
    window.localStorage.setItem(
      "typeflow.sync.v1",
      JSON.stringify({ lastPulledSeq: 0, pendingIds: [], clearEpoch: 100 })
    );

    apiMocks.pullRuns.mockResolvedValueOnce({
      runs: [],
      nextAfter: 0,
      clearEpoch: 500,
    });

    await pullAndMerge();
    expect(loadHistory()).toEqual([]);
  });
});

describe("syncNow", () => {
  it("sets error status on network failure without throwing", async () => {
    apiMocks.pushRuns.mockRejectedValueOnce(new Error("offline"));
    await syncNow();
    expect(getSyncStatus()).toBe("error");
  });

  it("retries pending on next sync", async () => {
    saveRun(makeRun("pending-1"));
    queueRun("pending-1");

    apiMocks.pushRuns
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce({ accepted: ["pending-1"], skipped: [] });
    apiMocks.pullRuns.mockResolvedValue({
      runs: [],
      nextAfter: 0,
      clearEpoch: 0,
    });

    await syncNow();
    expect(getSyncStatus()).toBe("error");

    await syncNow();
    expect(getSyncStatus()).toBe("synced");
    expect(apiMocks.pushRuns).toHaveBeenCalledTimes(2);
  });

  it("records last synced timestamp on success", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T12:00:00Z"));

    apiMocks.pushRuns.mockResolvedValueOnce({ accepted: [], skipped: [] });
    apiMocks.pullRuns.mockResolvedValueOnce({
      runs: [],
      nextAfter: 0,
      clearEpoch: 0,
    });

    await syncNow();

    expect(getLastSyncedAt()).toBe(Date.parse("2026-06-09T12:00:00Z"));
    expect(
      JSON.parse(window.localStorage.getItem("typeflow.sync.v1")!).lastSyncedAt
    ).toBe(Date.parse("2026-06-09T12:00:00Z"));

    vi.useRealTimers();
  });
});

describe("formatLastSyncedAt", () => {
  it("formats recent and missing timestamps", () => {
    const now = Date.parse("2026-06-09T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    expect(formatLastSyncedAt(null)).toBe("Not synced yet");
    expect(formatLastSyncedAt(now - 30_000)).toBe("just now");
    expect(formatLastSyncedAt(now - 120_000)).toBe("2 min ago");

    vi.useRealTimers();
  });
});
