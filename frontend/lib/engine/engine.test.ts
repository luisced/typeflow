import { describe, it, expect } from "vitest";
import { applyKey, charStates, correctChars, createState } from "./index";

function typeSeq(words: string[], keys: string[], mode: "words" = "words") {
  let s = createState(words);
  for (const k of keys) s = applyKey(s, k, mode);
  return s;
}

describe("engine", () => {
  it("marks correct and incorrect chars", () => {
    const s = typeSeq(["cat"], ["c", "x", "t"]);
    expect(charStates("cat", s.typed[0])).toEqual([
      "correct",
      "incorrect",
      "correct",
    ]);
    expect(s.totalKeystrokes).toBe(3);
    expect(s.correctKeystrokes).toBe(2);
    expect(s.errorMap["a"]).toBe(1);
  });

  it("backspaces within a word but not across boundaries", () => {
    let s = typeSeq(["go", "on"], ["g", "o", " ", "o"]);
    expect(s.wordIndex).toBe(1);
    s = applyKey(s, "Backspace", "words"); // removes the 'o'
    expect(s.typed[1]).toBe("");
    s = applyKey(s, "Backspace", "words"); // can't cross back
    expect(s.wordIndex).toBe(1);
    expect(s.typed[0]).toBe("go");
  });

  it("finishes when last word is typed exactly", () => {
    const s = typeSeq(["hi", "yo"], ["h", "i", " ", "y", "o"]);
    expect(s.finished).toBe(true);
  });

  it("does not advance on space before reaching the end of the current word", () => {
    const s = typeSeq(["cat", "dog"], ["c", " "]);
    expect(s.wordIndex).toBe(0);
    expect(s.typed[0]).toBe("c");
    expect(s.typed[1]).toBeUndefined();
  });

  it("counts correct chars including committed spaces", () => {
    const s = typeSeq(["hi", "yo"], ["h", "i", " ", "y"]);
    // "hi" (2) + space (1) + "y" (1) = 4
    expect(correctChars(s)).toBe(4);
  });

  it("ignores leading space and overflow beyond cap", () => {
    const s = typeSeq(["a"], [" "]);
    expect(s.wordIndex).toBe(0);
    expect(s.typed[0]).toBe("");
  });
});

describe("engine keystroke accounting", () => {
  it("counts a committed space as a correct keystroke", () => {
    const s = typeSeq(["hi", "yo"], ["h", "i", " "]);
    expect(s.totalKeystrokes).toBe(3);
    expect(s.correctKeystrokes).toBe(3);
  });

  it("counts a premature space as a miss against the expected char", () => {
    const s = typeSeq(["cat"], ["c", " "]);
    expect(s.wordIndex).toBe(0); // still blocked
    expect(s.typed[0]).toBe("c");
    expect(s.totalKeystrokes).toBe(2);
    expect(s.correctKeystrokes).toBe(1);
    expect(s.errorMap["a"]).toBe(1);
  });

  it("a leading space counts as a miss on the first expected char", () => {
    const s = typeSeq(["cat"], [" "]);
    expect(s.totalKeystrokes).toBe(1);
    expect(s.errorMap).toEqual({ c: 1 });
    expect(s.keyMap).toEqual({ c: 1 });
  });

  it("attributes extra chars to the overflow bucket", () => {
    // second word keeps the test unfinished so the extra char registers
    const s = typeSeq(["hi", "yo"], ["h", "i", "x"]);
    expect(s.errorMap["·"]).toBe(1);
    expect(s.correctKeystrokes).toBe(2);
  });

  it("caps overflow at MAX_EXTRA chars per word", () => {
    const overflow = Array.from({ length: 20 }, () => "x");
    const s = typeSeq(["a", "b"], ["a", ...overflow]);
    expect(s.typed[0].length).toBe(1 + 8); // target + cap
    expect(s.totalKeystrokes).toBe(1 + 8); // ignored keys don't count
  });

  it("ignores non-printable keys", () => {
    let s = createState(["hi"]);
    for (const k of ["Shift", "ArrowLeft", "Enter", "\t", "\n"]) {
      s = applyKey(s, k, "words");
    }
    expect(s.typed[0]).toBe("");
    expect(s.totalKeystrokes).toBe(0);
  });

  it("ignores all input once finished", () => {
    let s = typeSeq(["hi"], ["h", "i"]);
    expect(s.finished).toBe(true);
    const frozen = s;
    s = applyKey(s, "x", "words");
    s = applyKey(s, "Backspace", "words");
    expect(s).toBe(frozen);
  });

  it("time mode never finishes via the engine", () => {
    let s = createState(["hi"]);
    s = applyKey(s, "h", "time");
    s = applyKey(s, "i", "time");
    s = applyKey(s, " ", "time");
    expect(s.finished).toBe(false);
    expect(s.wordIndex).toBe(1);
  });

  it("backspacing a fixed error keeps the original miss in errorMap", () => {
    const s = typeSeq(["cat"], ["c", "x", "Backspace", "a", "t"]);
    expect(s.errorMap["a"]).toBe(1);
    expect(s.typed[0]).toBe("cat");
    expect(s.finished).toBe(true);
  });

  it("increments keyMap for every expected-key attempt", () => {
    let s = createState(["hi"]);
    s = applyKey(s, "h", "time");
    expect(s.keyMap["h"]).toBe(1);
    expect(s.errorMap["h"]).toBeUndefined();

    s = applyKey(s, "x", "time"); // wrong key at position 1
    expect(s.keyMap["i"]).toBe(1);
    expect(s.errorMap["i"]).toBe(1);
  });

  it("counts blocked premature space as an attempt on the expected key", () => {
    let s = createState(["ab"]);
    s = applyKey(s, " ", "time");
    expect(s.keyMap["a"]).toBe(1);
    expect(s.errorMap["a"]).toBe(1);
  });
});
