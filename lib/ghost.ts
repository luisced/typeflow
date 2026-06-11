import { correctChars, type EngineState } from "./engine";
import { flagsKeyForMode, normalizeContentFlags } from "./contentFlags";
import { loadHistory, personalBest } from "./storage";
import type { Mode, RunRecord, TestConfig } from "./types";

const GHOSTS_KEY = "typeflow.ghosts.v1";
const GHOST_PREF_KEY = "typeflow.ghost.enabled.v1";

/** Cumulative ghost progress at each whole second. */
export interface GhostTrace {
  mode: Mode;
  value: number;
  flagsKey: string;
  wpm: number;
  runId: string;
  /** Cumulative correct chars, used for pace comparison. */
  points: number[];
  /** Cumulative typed chars, including incorrect input, when available. */
  rawPoints?: number[];
  /** Seconds when the PB run recorded a miss. */
  mistakeTimes?: number[];
  /** PB run accuracy. Omitted for legacy traces where it is unknown. */
  accuracy?: number;
  quoteText?: string;
}

export type GhostBucket = `${string}:${number}:${string}`;

export function ghostBucket(
  mode: Mode,
  value: number,
  flagsKey: string
): GhostBucket {
  return `${mode}:${value}:${flagsKey}`;
}

export function encodeTrace(trace: GhostTrace): string {
  return JSON.stringify(trace);
}

export function decodeTrace(raw: string): GhostTrace | null {
  try {
    const parsed = JSON.parse(raw) as GhostTrace;
    if (!parsed || !Array.isArray(parsed.points)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function pointsFromSamples(samples: number[] | undefined): number[] {
  const points: number[] = [];
  let cumulative = 0;
  for (let i = 0; i < (samples?.length ?? 0); i++) {
    const delta = samples?.[i] ?? 0;
    cumulative += Math.round((delta / 60) * 5);
    points.push(cumulative);
  }
  return points;
}

function mistakeTimesFromRun(record: RunRecord): number[] {
  if (record.keyLog?.length) {
    return record.keyLog
      .filter((event) => event.ok === false)
      .map((event) => Math.round((event.t / 1000) * 1000) / 1000);
  }
  return (record.errorSeconds ?? []).map((sec) => Math.max(0, sec));
}

export function traceFromRun(record: RunRecord): GhostTrace | null {
  if (record.isComparable === false || record.wpm <= 0) return null;
  const flagsKey = record.flagsKey ?? flagsKeyForMode(record.mode, record.flags);
  const points = pointsFromSamples(record.samples);
  const rawPoints = pointsFromSamples(record.rawSamples);
  const mistakeTimes = mistakeTimesFromRun(record);
  if (points.length === 0) return null;
  return {
    mode: record.mode,
    value: record.value,
    flagsKey,
    wpm: record.wpm,
    runId: record.id,
    points,
    ...(rawPoints.length > 0 ? { rawPoints } : {}),
    ...(mistakeTimes.length > 0 ? { mistakeTimes } : {}),
    ...(Number.isFinite(record.accuracy) ? { accuracy: record.accuracy } : {}),
    ...(record.mode === "quote" && record.words
      ? { quoteText: record.words.join(" ") }
      : {}),
  };
}

function loadGhosts(): Record<string, GhostTrace> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(GHOSTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    const out: Record<string, GhostTrace> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const trace = typeof v === "string" ? decodeTrace(v) : (v as GhostTrace);
      if (trace) out[k] = trace;
    }
    return out;
  } catch {
    return {};
  }
}

function saveGhosts(ghosts: Record<string, GhostTrace>): void {
  try {
    if (typeof window !== "undefined") {
      const encoded: Record<string, string> = {};
      for (const [k, v] of Object.entries(ghosts)) {
        encoded[k] = encodeTrace(v);
      }
      window.localStorage.setItem(GHOSTS_KEY, JSON.stringify(encoded));
    }
  } catch {
    /* quota */
  }
}

export function loadGhostEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(GHOST_PREF_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveGhostEnabled(enabled: boolean): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(GHOST_PREF_KEY, enabled ? "1" : "0");
    }
  } catch {
    /* ignore */
  }
}

export function getGhostForConfig(config: TestConfig): GhostTrace | null {
  const flagsKey = flagsKeyForMode(
    config.mode,
    normalizeContentFlags(config.flags)
  );
  const bucket = ghostBucket(config.mode, config.value, flagsKey);
  return loadGhosts()[bucket] ?? null;
}

export function maybeStoreGhostPb(record: RunRecord, isPb: boolean): void {
  if (!isPb) return;
  const trace = traceFromRun(record);
  if (!trace) return;
  const bucket = ghostBucket(trace.mode, trace.value, trace.flagsKey);
  const ghosts = loadGhosts();
  ghosts[bucket] = trace;
  saveGhosts(ghosts);
}

function interpolatePoints(points: number[], elapsedSec: number): number {
  if (points.length === 0) return 0;
  const idx = Math.floor(elapsedSec);
  if (idx <= 0) return 0;
  if (idx >= points.length) return points[points.length - 1];
  const prev = points[idx - 1] ?? 0;
  const next = points[idx] ?? prev;
  const frac = elapsedSec - idx;
  return Math.round(prev + (next - prev) * frac);
}

/** Interpolate ghost cumulative correct chars at elapsed seconds. */
export function ghostCorrectAt(trace: GhostTrace, elapsedSec: number): number {
  return interpolatePoints(trace.points, elapsedSec);
}

/** Interpolate ghost cumulative typed chars, falling back for legacy traces. */
export function ghostRawAt(trace: GhostTrace, elapsedSec: number): number {
  return interpolatePoints(trace.rawPoints ?? trace.points, elapsedSec);
}

export function ghostMistakesAt(trace: GhostTrace, elapsedSec: number): number {
  const mistakes = trace.mistakeTimes ?? [];
  let count = 0;
  for (const t of mistakes) {
    if (t <= elapsedSec) count++;
  }
  return count;
}

export function ghostMistakeActive(
  trace: GhostTrace,
  elapsedSec: number,
  windowSec = 0.35
): boolean {
  return (trace.mistakeTimes ?? []).some(
    (t) => t <= elapsedSec && elapsedSec - t <= windowSec
  );
}

export function ghostAccuracy(trace: GhostTrace): number | null {
  return Number.isFinite(trace.accuracy) ? trace.accuracy! : null;
}

/** Map cumulative correct count to a char index in the current word stream. */
export function charIndexForCorrectCount(
  words: string[],
  correctCount: number
): { wordIndex: number; charIndex: number } {
  let remaining = Math.max(0, correctCount);
  for (let wi = 0; wi < words.length; wi++) {
    const word = words[wi];
    if (remaining <= word.length) {
      return { wordIndex: wi, charIndex: remaining };
    }
    remaining -= word.length;
    if (wi < words.length - 1) {
      if (remaining <= 0) {
        return { wordIndex: wi, charIndex: word.length };
      }
      remaining -= 1;
    }
  }
  const last = Math.max(0, words.length - 1);
  return { wordIndex: last, charIndex: words[last]?.length ?? 0 };
}

export function ghostMatchesQuote(
  trace: GhostTrace | null,
  words: string[]
): boolean {
  if (!trace || trace.mode !== "quote") return true;
  if (!trace.quoteText) return false;
  return trace.quoteText === words.join(" ");
}

export function charsAhead(
  playerCorrect: number,
  ghostCorrect: number
): number {
  return playerCorrect - ghostCorrect;
}

export function pbRunForConfig(config: TestConfig): RunRecord | null {
  const flagsKey = flagsKeyForMode(
    config.mode,
    normalizeContentFlags(config.flags)
  );
  const history = loadHistory();
  const bestWpm = personalBest(
    history,
    config.mode,
    config.value,
    undefined,
    flagsKey
  );
  if (bestWpm <= 0) return null;
  return (
    history
      .filter((r) => {
        if (r.isComparable === false) return false;
        if (r.mode !== config.mode) return false;
        if (config.mode !== "quote" && r.value !== config.value) return false;
        if (config.mode !== "quote") {
          const rk = r.flagsKey ?? flagsKeyForMode(r.mode, r.flags);
          if (rk !== flagsKey) return false;
        }
        return r.wpm === bestWpm;
      })
      .sort((a, b) => b.date - a.date)[0] ?? null
  );
}

/** Build a ghost trace from the synced PB when no local trace exists yet. */
export function ensureGhostForConfig(config: TestConfig): GhostTrace | null {
  const existing = getGhostForConfig(config);
  if (existing) return existing;
  const pb = pbRunForConfig(config);
  if (!pb) return null;
  const trace = traceFromRun(pb);
  if (!trace) return null;
  const bucket = ghostBucket(trace.mode, trace.value, trace.flagsKey);
  const ghosts = loadGhosts();
  ghosts[bucket] = trace;
  saveGhosts(ghosts);
  return trace;
}

export function ghostPositionAt(
  engine: EngineState,
  trace: GhostTrace,
  elapsedSec: number
): { wordIndex: number; charIndex: number } | null {
  const ghostCorrect = ghostCorrectAt(trace, elapsedSec);
  return charIndexForCorrectCount(engine.words, ghostCorrect);
}
