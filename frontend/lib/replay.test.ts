import { describe, expect, it } from "vitest";
import { canReplay, formatReplayClock, replayDurationMs } from "./replay";
import type { RunRecord } from "./types";

function run(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id: "r1",
    mode: "time",
    value: 30,
    wpm: 80,
    raw: 84,
    accuracy: 95,
    consistency: 63,
    durationSec: 30,
    date: 1,
    errorMap: {},
    keyMap: {},
    samples: [80],
    words: ["hello", "world"],
    keyLog: [
      { key: "h", t: 100, ok: true },
      { key: "e", t: 200, ok: true },
    ],
    ...overrides,
  };
}

describe("canReplay", () => {
  it("is true when words and keyLog exist", () => {
    expect(canReplay(run())).toBe(true);
  });

  it("is false when replay data is missing", () => {
    expect(canReplay(run({ words: undefined }))).toBe(false);
    expect(canReplay(run({ keyLog: undefined }))).toBe(false);
    expect(canReplay(run({ words: [], keyLog: [] }))).toBe(false);
  });
});

describe("replayDurationMs", () => {
  it("uses the later of last key time and durationSec", () => {
    expect(replayDurationMs(run({ durationSec: 30 }))).toBe(30_000);
    expect(
      replayDurationMs(
        run({
          durationSec: 5,
          keyLog: [{ key: "a", t: 9000, ok: true }],
        })
      )
    ).toBe(9000);
  });
});

describe("formatReplayClock", () => {
  it("formats elapsed and total seconds", () => {
    expect(formatReplayClock(12_400, 30_000)).toBe("12.4s / 30.0s");
  });
});
