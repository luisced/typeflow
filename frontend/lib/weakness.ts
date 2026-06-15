import type { RunRecord } from "./types";

const LOOKBACK = 30;
const HALF_LIFE = 10;
const MIN_ATTEMPTS = 20;
const NOISE_THRESHOLD = 0.04;

function decayWeight(ageFromNewest: number): number {
  return Math.pow(0.5, ageFromNewest / HALF_LIFE);
}

function comparableRuns(history: RunRecord[]): RunRecord[] {
  return history.filter(
    (r) => r.mode !== "practice" && r.isComparable !== false
  );
}

/** Per-char weakness score from recent history (0–1 miss rate with decay). */
export function weaknessForChar(char: string, history: RunRecord[]): number {
  const runs = comparableRuns(history).slice(-LOOKBACK);
  if (runs.length === 0) return 0;

  let weightedMisses = 0;
  let weightedAttempts = 0;
  const newest = runs.length - 1;

  for (let i = 0; i < runs.length; i++) {
    const w = decayWeight(newest - i);
    const attempts = runs[i].keyMap[char] ?? 0;
    const misses = runs[i].errorMap[char] ?? 0;
    weightedAttempts += attempts * w;
    weightedMisses += misses * w;
  }

  const denom = Math.max(weightedAttempts, MIN_ATTEMPTS);
  return weightedMisses / denom;
}

export type WeakChar = { char: string; score: number };

/** Ranked weak characters above the noise floor. */
export function weakChars(history: RunRecord[]): WeakChar[] {
  const runs = comparableRuns(history).slice(-LOOKBACK);
  const chars = new Set<string>();
  for (const r of runs) {
    for (const ch of Object.keys(r.keyMap)) chars.add(ch);
    for (const ch of Object.keys(r.errorMap)) chars.add(ch);
  }

  return [...chars]
    .map((char) => ({ char, score: weaknessForChar(char, history) }))
    .filter((w) => w.score >= NOISE_THRESHOLD)
    .sort((a, b) => b.score - a.score);
}

export function targetKeysForPractice(history: RunRecord[], limit = 6): string[] {
  return weakChars(history)
    .slice(0, limit)
    .map((w) => w.char);
}
