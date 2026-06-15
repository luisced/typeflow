import { describe, expect, it } from "vitest";
import { localProgressSummary } from "./progress";
import type { RunRecord } from "./types";

function makeRun(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id: Math.random().toString(36).slice(2),
    mode: "time",
    value: 30,
    wpm: 70,
    raw: 75,
    accuracy: 95,
    consistency: 80,
    durationSec: 30,
    date: Date.now(),
    errorMap: {},
    keyMap: {},
    samples: [],
    ...overrides,
  };
}

describe("localProgressSummary", () => {
  it("excludes practice runs by default", () => {
    const history = [
      makeRun({ wpm: 80 }),
      makeRun({ mode: "practice", wpm: 120, isComparable: false }),
    ];
    const s = localProgressSummary(history);
    expect(s.totalRuns).toBe(1);
    expect(s.bestWpm).toBe(80);
  });

  it("filters by flagsKey", () => {
    const history = [
      makeRun({ wpm: 70, flagsKey: "base" }),
      makeRun({ wpm: 95, flagsKey: "c" }),
    ];
    const s = localProgressSummary(history, { flagsKey: "c" });
    expect(s.totalRuns).toBe(1);
    expect(s.bestWpm).toBe(95);
  });
});
