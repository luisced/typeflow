import { describe, expect, it } from "vitest";
import type { RunRecord } from "./types";
import { targetKeysForPractice, weakChars, weaknessForChar } from "./weakness";

function makeRun(
  keyMap: Record<string, number>,
  errorMap: Record<string, number>,
  overrides: Partial<RunRecord> = {}
): RunRecord {
  return {
    id: Math.random().toString(36).slice(2),
    mode: "time",
    value: 30,
    wpm: 60,
    raw: 65,
    accuracy: 96,
    consistency: 80,
    durationSec: 30,
    date: Date.now(),
    errorMap,
    keyMap,
    samples: [],
    ...overrides,
  };
}

describe("weaknessForChar", () => {
  it("returns 0 with no history", () => {
    expect(weaknessForChar("r", [])).toBe(0);
  });

  it("floors attempts at 20 for rare keys", () => {
    const history = [makeRun({ r: 1 }, { r: 1 })];
    expect(weaknessForChar("r", history)).toBeCloseTo(1 / 20, 5);
  });

  it("weights recent runs more heavily", () => {
    const old = makeRun({ e: 40 }, { e: 20 }, { date: 1 });
    const recent = makeRun({ e: 40 }, { e: 4 }, { date: 2 });
    const score = weaknessForChar("e", [old, recent]);
    expect(score).toBeLessThan(0.5);
    expect(score).toBeGreaterThan(0.05);
  });

  it("ignores practice and non-comparable runs", () => {
    const history = [
      makeRun({ r: 40 }, { r: 40 }, { mode: "practice", isComparable: false }),
      makeRun({ r: 40 }, { r: 40 }, { isComparable: false }),
    ];
    expect(weaknessForChar("r", history)).toBe(0);
  });
});

describe("weakChars", () => {
  it("ranks high-miss keys above noise floor", () => {
    const history = [
      makeRun({ r: 50, e: 50 }, { r: 15, e: 1 }),
      makeRun({ r: 50, e: 50 }, { r: 12, e: 1 }),
    ];
    const weak = weakChars(history);
    expect(weak[0].char).toBe("r");
    expect(weak.some((w) => w.char === "e")).toBe(false);
  });
});

describe("targetKeysForPractice", () => {
  it("returns top weak keys up to the limit", () => {
    const history = [
      makeRun({ a: 30, b: 30, c: 30 }, { a: 10, b: 8, c: 2 }),
      makeRun({ a: 30, b: 30, c: 30 }, { a: 9, b: 7, c: 1 }),
    ];
    expect(targetKeysForPractice(history, 2)).toEqual(["a", "b"]);
  });
});
