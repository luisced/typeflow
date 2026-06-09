import type { CharState, Mode } from "../types";

// Pure, framework-free typing-test state machine.
// Behavior: allow-through errors (wrong chars stay), in-word backspace allowed,
// cannot return to previous words once a space commits the current word.

const MAX_EXTRA = 8; // cap overflow chars per word

export interface EngineState {
  words: string[];
  /** typed[i] holds what the user typed for word i (only up to wordIndex) */
  typed: string[];
  wordIndex: number;
  finished: boolean;
  totalKeystrokes: number;
  correctKeystrokes: number;
  errorMap: Record<string, number>;
  keyMap: Record<string, number>;
}

export function createState(words: string[]): EngineState {
  return {
    words,
    typed: words.length ? [""] : [],
    wordIndex: 0,
    finished: false,
    totalKeystrokes: 0,
    correctKeystrokes: 0,
    errorMap: {},
    keyMap: {},
  };
}

/** Append more words (used by time mode to keep an endless stream). */
export function appendWords(state: EngineState, more: string[]): EngineState {
  return { ...state, words: [...state.words, ...more] };
}

function isPrintable(key: string): boolean {
  return key.length === 1 && key !== "\n" && key !== "\t";
}

function bumpKey(map: Record<string, number>, key: string): Record<string, number> {
  return { ...map, [key]: (map[key] ?? 0) + 1 };
}

export function applyKey(
  state: EngineState,
  key: string,
  mode: Mode
): EngineState {
  if (state.finished) return state;

  const { words, wordIndex } = state;
  const current = state.typed[wordIndex] ?? "";
  const target = words[wordIndex] ?? "";

  if (key === "Backspace") {
    if (current.length === 0) return state; // can't cross word boundary
    const typed = state.typed.slice();
    typed[wordIndex] = current.slice(0, -1);
    return { ...state, typed };
  }

  if (key === " ") {
    if (current.length < target.length) {
      // premature space: blocked, but still a keystroke and a miss
      const k = target[current.length] ?? "·";
      return {
        ...state,
        totalKeystrokes: state.totalKeystrokes + 1,
        errorMap: { ...state.errorMap, [k]: (state.errorMap[k] ?? 0) + 1 },
        keyMap: bumpKey(state.keyMap, k),
      };
    }
    const nextIndex = wordIndex + 1;
    const finished = mode !== "time" && nextIndex >= words.length;
    const typed = state.typed.slice();
    if (!finished && nextIndex < words.length) typed[nextIndex] = "";
    return {
      ...state,
      typed,
      wordIndex: nextIndex,
      finished,
      // a committed space is a real (correct) keystroke
      totalKeystrokes: state.totalKeystrokes + 1,
      correctKeystrokes: state.correctKeystrokes + 1,
      keyMap: bumpKey(state.keyMap, " "),
    };
  }

  if (!isPrintable(key)) return state;

  // overflow cap
  if (current.length >= target.length + MAX_EXTRA) return state;

  const pos = current.length;
  const expected = target[pos];
  const correct = pos < target.length && key === expected;

  const errorMap = state.errorMap;
  let nextErrorMap = errorMap;
  if (!correct) {
    const k = expected ?? "·";
    nextErrorMap = { ...errorMap, [k]: (errorMap[k] ?? 0) + 1 };
  }

  const typed = state.typed.slice();
  typed[wordIndex] = current + key;

  // words/quote: finishing the final word exactly ends the test
  const isLast = wordIndex === words.length - 1;
  const finished =
    mode !== "time" && isLast && typed[wordIndex] === target;

  return {
    ...state,
    typed,
    finished,
    totalKeystrokes: state.totalKeystrokes + 1,
    correctKeystrokes: state.correctKeystrokes + (correct ? 1 : 0),
    errorMap: nextErrorMap,
    keyMap: bumpKey(state.keyMap, expected ?? "·"),
  };
}

/** Per-character render state for a given word. */
export function charStates(
  target: string,
  typed: string | undefined
): CharState[] {
  const t = typed ?? "";
  const out: CharState[] = [];
  const len = Math.max(target.length, t.length);
  for (let i = 0; i < len; i++) {
    if (i >= target.length) out.push("extra");
    else if (i >= t.length) out.push("untyped");
    else out.push(t[i] === target[i] ? "correct" : "incorrect");
  }
  return out;
}

/** Count correctly typed characters (incl. committed spaces) for WPM. */
export function correctChars(state: EngineState): number {
  let chars = 0;
  for (let i = 0; i < state.wordIndex; i++) {
    const target = state.words[i] ?? "";
    const t = state.typed[i] ?? "";
    for (let j = 0; j < target.length; j++) {
      if (t[j] === target[j]) chars++;
    }
    chars++; // the committed space
  }
  // current (uncommitted) word
  const target = state.words[state.wordIndex] ?? "";
  const t = state.typed[state.wordIndex] ?? "";
  for (let j = 0; j < target.length; j++) {
    if (t[j] === target[j]) chars++;
  }
  return chars;
}
