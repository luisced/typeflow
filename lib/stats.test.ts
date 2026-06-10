import { describe, expect, it } from "vitest";
import { applyKey, createState } from "./engine";
import {
  computeAccuracy,
  computeConsistency,
  computeWpm,
  isMissKeystroke,
  totalTypedChars,
} from "./stats";

describe("computeWpm", () => {
  it("computes net and raw WPM from chars and seconds", () => {
    // 100 correct chars in 60s = 20 wpm; 125 typed = 25 raw
    expect(computeWpm(100, 125, 60)).toEqual({ wpm: 20, raw: 25 });
  });

  it("scales with duration", () => {
    expect(computeWpm(50, 50, 30)).toEqual({ wpm: 20, raw: 20 });
    expect(computeWpm(50, 50, 15)).toEqual({ wpm: 40, raw: 40 });
  });

  it("returns zero for zero or negative duration", () => {
    expect(computeWpm(100, 100, 0)).toEqual({ wpm: 0, raw: 0 });
    expect(computeWpm(100, 100, -5)).toEqual({ wpm: 0, raw: 0 });
  });

  it("returns zero for zero chars", () => {
    expect(computeWpm(0, 0, 60)).toEqual({ wpm: 0, raw: 0 });
  });

  it("rounds to the nearest integer", () => {
    // 11 chars / 5 = 2.2 words in 60s -> 2 wpm
    expect(computeWpm(11, 11, 60).wpm).toBe(2);
    // 13 chars / 5 = 2.6 -> 3 wpm
    expect(computeWpm(13, 13, 60).wpm).toBe(3);
  });
});

describe("computeAccuracy", () => {
  function typeSeq(words: string[], keys: string[]) {
    let s = createState(words);
    for (const k of keys) s = applyKey(s, k, "words");
    return s;
  }

  it("is 100 before any keystroke", () => {
    expect(computeAccuracy(createState(["cat"]))).toBe(100);
  });

  it("is 100 for a perfect run", () => {
    expect(computeAccuracy(typeSeq(["cat"], ["c", "a", "t"]))).toBe(100);
  });

  it("counts misses against accuracy", () => {
    // 2 correct of 3 keystrokes = 67%
    expect(computeAccuracy(typeSeq(["cat"], ["c", "x", "t"]))).toBe(67);
  });

  it("counts committed spaces as correct keystrokes", () => {
    // "hi" + space + "yo" = 5 keystrokes, all correct
    const s = typeSeq(["hi", "yo"], ["h", "i", " ", "y", "o"]);
    expect(s.totalKeystrokes).toBe(5);
    expect(s.correctKeystrokes).toBe(5);
    expect(computeAccuracy(s)).toBe(100);
  });

  it("counts a premature space as a miss", () => {
    // space after "c" in "cat" is blocked but penalized
    const s = typeSeq(["cat", "dog"], ["c", " ", "a", "t", " "]);
    expect(s.totalKeystrokes).toBe(5);
    expect(s.correctKeystrokes).toBe(4);
    expect(computeAccuracy(s)).toBe(80);
  });

  it("backspace neither adds nor removes keystrokes", () => {
    const s = typeSeq(["cat"], ["c", "x", "Backspace", "a", "t"]);
    expect(s.totalKeystrokes).toBe(4); // c, x, a, t
    expect(s.correctKeystrokes).toBe(3);
    expect(computeAccuracy(s)).toBe(75);
  });
});

describe("computeConsistency", () => {
  it("is 100 for perfectly steady samples", () => {
    expect(computeConsistency([60, 60, 60, 60])).toBe(100);
  });

  it("is 100 with fewer than two non-zero samples", () => {
    expect(computeConsistency([])).toBe(100);
    expect(computeConsistency([80])).toBe(100);
    expect(computeConsistency([0, 0, 75])).toBe(100);
  });

  it("ignores zero samples (idle seconds)", () => {
    expect(computeConsistency([60, 0, 60, 0, 60])).toBe(100);
  });

  it("drops as variance grows", () => {
    const steady = computeConsistency([58, 60, 62, 60]);
    const wild = computeConsistency([20, 100, 20, 100]);
    expect(steady).toBeGreaterThan(wild);
    expect(wild).toBeLessThan(70);
  });

  it("stays within 0..100", () => {
    expect(computeConsistency([1, 200, 1, 200, 1])).toBeGreaterThanOrEqual(0);
    expect(computeConsistency([1, 200, 1, 200, 1])).toBeLessThanOrEqual(100);
  });
});

describe("totalTypedChars", () => {
  function typeSeq(words: string[], keys: string[]) {
    let s = createState(words);
    for (const k of keys) s = applyKey(s, k, "words");
    return s;
  }

  it("counts typed chars plus committed spaces", () => {
    // "hi" (2) + space (1) + "y" (1) = 4
    expect(totalTypedChars(typeSeq(["hi", "yo"], ["h", "i", " ", "y"]))).toBe(
      4
    );
  });

  it("counts wrong and extra chars too (raw)", () => {
    const s = typeSeq(["hi"], ["h", "x", "z"]);
    expect(totalTypedChars(s)).toBe(3);
  });

  it("is zero before typing", () => {
    expect(totalTypedChars(createState(["hi"]))).toBe(0);
  });
});

describe("isMissKeystroke", () => {
  it("detects wrong chars and premature spaces", () => {
    let s = createState(["cat"]);
    const wrong = applyKey(s, "x", "words");
    expect(isMissKeystroke(s, wrong)).toBe(true);

    s = createState(["cat"]);
    const correct = applyKey(s, "c", "words");
    expect(isMissKeystroke(s, correct)).toBe(false);

    s = createState(["cat"]);
    const earlySpace = applyKey(s, " ", "words");
    expect(isMissKeystroke(s, earlySpace)).toBe(true);
  });

  it("ignores backspace", () => {
    let s = createState(["cat"]);
    s = applyKey(s, "x", "words");
    const back = applyKey(s, "Backspace", "words");
    expect(isMissKeystroke(s, back)).toBe(false);
  });
});
