import { describe, expect, it } from "vitest";
import {
  charIndexForCorrectCount,
  decodeTrace,
  encodeTrace,
  ghostAccuracy,
  ghostCorrectAt,
  ghostMistakesAt,
  ghostRawAt,
  traceFromRun,
} from "./ghost";
import type { RunRecord } from "./types";

function makeRun(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id: "r1",
    mode: "time",
    value: 30,
    wpm: 90,
    raw: 95,
    accuracy: 96,
    consistency: 80,
    durationSec: 30,
    date: Date.now(),
    errorMap: {},
    keyMap: {},
    samples: [60, 120],
    ...overrides,
  };
}

describe("ghost trace codec", () => {
  it("round-trips encode/decode", () => {
    const trace = traceFromRun(makeRun())!;
    const raw = encodeTrace(trace);
    expect(decodeTrace(raw)).toEqual(trace);
  });
});

describe("ghostCorrectAt", () => {
  it("interpolates between seconds", () => {
    const trace = traceFromRun(makeRun({ samples: [60, 120] }))!;
    expect(ghostCorrectAt(trace, 0)).toBe(0);
    expect(ghostCorrectAt(trace, 1)).toBeGreaterThan(0);
  });
});

describe("ghost trace accuracy model", () => {
  it("stores raw progress, mistake timings, and PB accuracy", () => {
    const trace = traceFromRun(
      makeRun({
        accuracy: 80,
        samples: [60, 60],
        rawSamples: [120, 60],
        keyLog: [
          { key: "a", t: 100, ok: true },
          { key: "x", t: 250, ok: false },
          { key: "b", t: 1200, ok: true },
        ],
      })
    )!;

    expect(trace.accuracy).toBe(80);
    expect(trace.rawPoints).toEqual([10, 15]);
    expect(trace.mistakeTimes).toEqual([0.25]);
    expect(ghostAccuracy(trace)).toBe(80);
    expect(ghostRawAt(trace, 1)).toBeGreaterThan(ghostCorrectAt(trace, 1));
    expect(ghostMistakesAt(trace, 0.2)).toBe(0);
    expect(ghostMistakesAt(trace, 0.3)).toBe(1);
  });

  it("keeps legacy correct-only traces usable without inventing perfect accuracy", () => {
    const trace = decodeTrace(
      JSON.stringify({
        mode: "time",
        value: 30,
        flagsKey: "base",
        wpm: 90,
        runId: "legacy",
        points: [5, 10],
      })
    )!;

    expect(ghostCorrectAt(trace, 1)).toBe(5);
    expect(ghostRawAt(trace, 1)).toBe(5);
    expect(ghostMistakesAt(trace, 10)).toBe(0);
    expect(ghostAccuracy(trace)).toBeNull();
  });
});

describe("charIndexForCorrectCount", () => {
  it("maps cumulative correct chars into word positions", () => {
    const words = ["ab", "cd"];
    expect(charIndexForCorrectCount(words, 0)).toEqual({ wordIndex: 0, charIndex: 0 });
    expect(charIndexForCorrectCount(words, 2)).toEqual({ wordIndex: 0, charIndex: 2 });
    expect(charIndexForCorrectCount(words, 3)).toEqual({ wordIndex: 1, charIndex: 0 });
  });
});
