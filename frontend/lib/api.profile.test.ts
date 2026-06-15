import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchProfileStats, setAccessToken } from "./api";

afterEach(() => {
  vi.restoreAllMocks();
  setAccessToken(null);
});

describe("fetchProfileStats", () => {
  it("returns parsed profile stats", async () => {
    setAccessToken("token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          summary: {
            bestWpm: 120,
            avgWpm: 98,
            avgAccuracy: 94,
            totalRuns: 3,
            totalTimeSec: 135,
          },
          dailyStats: [{ date: "2025-06-01", avgWpm: 110, runCount: 2 }],
          wpmHistory: [
            { finishedAt: "2025-06-01T10:00:00Z", wpm: 88 },
            { finishedAt: "2025-06-01T11:00:00Z", wpm: 91 },
          ],
          keyAccuracy: { t: 91 },
          keyTrends: { t: [88, 91] },
        }),
      })
    );

    const stats = await fetchProfileStats();
    expect(stats.summary.bestWpm).toBe(120);
    expect(stats.dailyStats[0].avgWpm).toBe(110);
    expect(stats.wpmHistory).toHaveLength(2);
    expect(stats.keyAccuracy.t).toBe(91);
    expect(stats.keyTrends.t).toEqual([88, 91]);
  });
});
