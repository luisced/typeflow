// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearHistory,
  loadHistory,
  mergeHistory,
  personalBest,
  replaceHistory,
  saveRun,
} from "./storage";
import type { RunRecord } from "./types";

function makeRun(overrides: Partial<RunRecord> = {}): RunRecord {
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
    errorMap: {},
    keyMap: {},
    samples: [55, 60, 65],
    ...overrides,
  };
}

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("loadHistory / saveRun", () => {
  it("returns empty history when nothing is stored", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("round-trips a saved run", () => {
    const run = makeRun();
    saveRun(run);
    expect(loadHistory()).toEqual([run]);
  });

  it("prepends newest runs first", () => {
    const a = makeRun({ id: "a" });
    const b = makeRun({ id: "b" });
    saveRun(a);
    saveRun(b);
    expect(loadHistory().map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("caps history at 1000 runs", () => {
    for (let i = 0; i < 1005; i++) saveRun(makeRun({ id: `run-${i}` }));
    const history = loadHistory();
    expect(history).toHaveLength(1000);
    expect(history[0].id).toBe("run-1004"); // newest kept
  });

  it("returns empty array for corrupt stored JSON", () => {
    window.localStorage.setItem("typeflow.history.v1", "{not json");
    expect(loadHistory()).toEqual([]);
  });

  it("returns empty array when stored value is not an array", () => {
    window.localStorage.setItem("typeflow.history.v1", '{"a":1}');
    expect(loadHistory()).toEqual([]);
  });

  it("does not throw when localStorage writes fail (private mode / quota)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const run = makeRun();
    expect(() => saveRun(run)).not.toThrow();
    // still returns the would-be history so the UI can proceed
    expect(saveRun(run)[0]).toEqual(run);
  });
});

describe("personalBest", () => {
  it("returns 0 with no matching runs", () => {
    expect(personalBest([], "time", 30)).toBe(0);
    expect(personalBest([makeRun({ mode: "words", value: 25 })], "time", 30)).toBe(0);
  });

  it("returns the max wpm for the same mode and value", () => {
    const history = [
      makeRun({ mode: "time", value: 30, wpm: 70 }),
      makeRun({ mode: "time", value: 30, wpm: 85 }),
      makeRun({ mode: "time", value: 60, wpm: 99 }), // different bucket
    ];
    expect(personalBest(history, "time", 30)).toBe(85);
  });

  it("excludes the given run id", () => {
    const history = [
      makeRun({ id: "current", mode: "time", value: 30, wpm: 90 }),
      makeRun({ id: "old", mode: "time", value: 30, wpm: 80 }),
    ];
    expect(personalBest(history, "time", 30, "current")).toBe(80);
  });

  it("shares one PB bucket for all quote runs regardless of value", () => {
    const history = [
      makeRun({ mode: "quote", value: 0, wpm: 75 }),
      // legacy record saved before quote value was normalized to 0
      makeRun({ mode: "quote", value: 30, wpm: 88 }),
    ];
    expect(personalBest(history, "quote", 0)).toBe(88);
  });

  it("buckets PB by flagsKey for time mode", () => {
    const history = [
      makeRun({ mode: "time", value: 30, wpm: 70, flagsKey: "base" }),
      makeRun({ mode: "time", value: 30, wpm: 90, flagsKey: "c,n" }),
      makeRun({ mode: "time", value: 30, wpm: 85, flagsKey: "c,n" }),
    ];
    expect(personalBest(history, "time", 30, undefined, "c,n")).toBe(90);
    expect(personalBest(history, "time", 30, undefined, "base")).toBe(70);
  });

  it("excludes non-comparable runs from PB", () => {
    const history = [
      makeRun({ mode: "time", value: 30, wpm: 99, isComparable: false }),
      makeRun({ mode: "time", value: 30, wpm: 80 }),
    ];
    expect(personalBest(history, "time", 30)).toBe(80);
  });

  it("quote PB ignores flagsKey on stored runs", () => {
    const history = [
      makeRun({ mode: "quote", value: 0, wpm: 70, flagsKey: "c" }),
      makeRun({ mode: "quote", value: 0, wpm: 82, flagsKey: "n,p" }),
    ];
    expect(personalBest(history, "quote", 0, undefined, "c,n,p")).toBe(82);
  });
});

describe("mergeHistory", () => {
  it("unions by id without duplicates", () => {
    saveRun(makeRun({ id: "a", wpm: 60, date: 100 }));
    mergeHistory([
      makeRun({ id: "b", wpm: 70, date: 200 }),
      makeRun({ id: "a", wpm: 65, date: 150 }),
    ]);
    const ids = loadHistory().map((r) => r.id);
    expect(ids).toEqual(["b", "a"]);
    expect(loadHistory().find((r) => r.id === "a")?.wpm).toBe(65);
  });
});

describe("replaceHistory", () => {
  it("replaces all stored runs", () => {
    saveRun(makeRun({ id: "old" }));
    replaceHistory([makeRun({ id: "new" })]);
    expect(loadHistory().map((r) => r.id)).toEqual(["new"]);
  });
});

describe("clearHistory", () => {
  it("removes stored history", () => {
    saveRun(makeRun());
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });

  it("does not throw when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => clearHistory()).not.toThrow();
  });
});
