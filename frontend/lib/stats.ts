import type { EngineState } from "./engine";

export interface FinalStats {
  wpm: number;
  raw: number;
  accuracy: number;
  consistency: number;
}

const round = (n: number) => Math.round(n);

/** Net WPM from correct chars, raw WPM from all typed chars. */
export function computeWpm(
  correctChars: number,
  totalTypedChars: number,
  seconds: number
): { wpm: number; raw: number } {
  const minutes = seconds / 60;
  if (minutes <= 0) return { wpm: 0, raw: 0 };
  return {
    wpm: Math.max(0, round(correctChars / 5 / minutes)),
    raw: Math.max(0, round(totalTypedChars / 5 / minutes)),
  };
}

export function computeAccuracy(state: EngineState): number {
  if (state.totalKeystrokes === 0) return 100;
  return round((state.correctKeystrokes / state.totalKeystrokes) * 100);
}

/** Consistency = 100 * (1 - coefficient of variation) over per-second WPM. */
export function computeConsistency(samples: number[]): number {
  const valid = samples.filter((s) => s > 0);
  if (valid.length < 2) return 100;
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  if (mean === 0) return 0;
  const variance =
    valid.reduce((a, b) => a + (b - mean) ** 2, 0) / valid.length;
  const cv = Math.sqrt(variance) / mean;
  return Math.max(0, Math.min(100, round((1 - cv) * 100)));
}

export function totalTypedChars(state: EngineState): number {
  let n = 0;
  for (let i = 0; i <= state.wordIndex; i++) {
    n += (state.typed[i] ?? "").length;
    if (i < state.wordIndex) n += 1; // committed space
  }
  return n;
}

/** True when a keystroke incremented total but not correct (a miss). */
export function isMissKeystroke(prev: EngineState, next: EngineState): boolean {
  return (
    next.totalKeystrokes > prev.totalKeystrokes &&
    next.correctKeystrokes === prev.correctKeystrokes
  );
}
