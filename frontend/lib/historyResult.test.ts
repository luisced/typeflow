// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { testResultFromRecord } from "./historyResult";
import { replaceHistory } from "./storage";
import type { RunRecord } from "./types";

function run(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id: "a",
    mode: "time",
    value: 30,
    wpm: 80,
    raw: 85,
    accuracy: 98,
    consistency: 90,
    durationSec: 30,
    date: 1,
    errorMap: {},
    keyMap: {},
    samples: [70, 80, 90],
    ...overrides,
  };
}

afterEach(() => {
  window.localStorage.clear();
});

describe("testResultFromRecord", () => {
  it("marks PB when run beats other runs for same mode/value", () => {
    replaceHistory([run({ id: "other", wpm: 80 }), run({ id: "best", wpm: 90 })]);
    const result = testResultFromRecord(run({ id: "best", wpm: 90 }));
    expect(result.isPB).toBe(true);
    expect(result.prevBest).toBe(80);
  });

  it("does not mark PB when a better run exists", () => {
    replaceHistory([run({ id: "other", wpm: 80 }), run({ id: "slower", wpm: 70 })]);
    const result = testResultFromRecord(run({ id: "slower", wpm: 70 }));
    expect(result.isPB).toBe(false);
    expect(result.prevBest).toBe(80);
  });
});
