import { flagsKeyForMode } from "./contentFlags";
import { loadHistory } from "./storage";
import type { Mode, RunRecord } from "./types";

export type ProgressFilters = {
  mode?: Mode;
  value?: number;
  flagsKey?: string;
  includePractice?: boolean;
};

export type LocalProgressSummary = {
  bestWpm: number;
  avgWpm: number;
  avgAccuracy: number;
  totalRuns: number;
  totalTimeSec: number;
  currentStreak: number;
  bestStreak: number;
};

function runFlagsKey(run: RunRecord): string {
  return run.flagsKey ?? flagsKeyForMode(run.mode, run.flags);
}

function matchesFilters(run: RunRecord, filters: ProgressFilters): boolean {
  if (!filters.includePractice) {
    if (run.mode === "practice" || run.isComparable === false) return false;
  }
  if (filters.mode && run.mode !== filters.mode) return false;
  if (filters.value != null && run.mode !== "quote" && run.value !== filters.value) {
    return false;
  }
  if (filters.flagsKey && run.mode !== "quote" && runFlagsKey(run) !== filters.flagsKey) {
    return false;
  }
  return true;
}

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function computeStreaks(runs: RunRecord[]): { current: number; best: number } {
  if (runs.length === 0) return { current: 0, best: 0 };
  const days = new Set(runs.map((r) => dayKey(r.date)));
  const sorted = [...days].sort();
  let best = 0;
  let streak = 0;
  let prev: string | null = null;

  for (const day of sorted) {
    if (prev) {
      const prevDate = new Date(`${prev}T12:00:00Z`);
      const curDate = new Date(`${day}T12:00:00Z`);
      const diff = (curDate.getTime() - prevDate.getTime()) / 86_400_000;
      streak = diff === 1 ? streak + 1 : 1;
    } else {
      streak = 1;
    }
    best = Math.max(best, streak);
    prev = day;
  }

  const today = dayKey(Date.now());
  const yesterday = dayKey(Date.now() - 86_400_000);
  let current = 0;
  if (days.has(today)) {
    current = 1;
    let d = today;
    while (true) {
      const prevDay = dayKey(new Date(`${d}T12:00:00Z`).getTime() - 86_400_000);
      if (!days.has(prevDay)) break;
      current++;
      d = prevDay;
    }
  } else if (days.has(yesterday)) {
    current = 1;
    let d = yesterday;
    while (true) {
      const prevDay = dayKey(new Date(`${d}T12:00:00Z`).getTime() - 86_400_000);
      if (!days.has(prevDay)) break;
      current++;
      d = prevDay;
    }
  }

  return { current, best };
}

export function filterRuns(
  history: RunRecord[],
  filters: ProgressFilters = {}
): RunRecord[] {
  return history.filter((r) => matchesFilters(r, filters));
}

export function localProgressSummary(
  history: RunRecord[] = loadHistory(),
  filters: ProgressFilters = {}
): LocalProgressSummary {
  const runs = filterRuns(history, filters);
  if (runs.length === 0) {
    return {
      bestWpm: 0,
      avgWpm: 0,
      avgAccuracy: 0,
      totalRuns: 0,
      totalTimeSec: 0,
      currentStreak: 0,
      bestStreak: 0,
    };
  }

  const streaks = computeStreaks(runs);
  return {
    bestWpm: Math.max(...runs.map((r) => r.wpm)),
    avgWpm: Math.round(runs.reduce((s, r) => s + r.wpm, 0) / runs.length),
    avgAccuracy: Math.round(
      runs.reduce((s, r) => s + r.accuracy, 0) / runs.length
    ),
    totalRuns: runs.length,
    totalTimeSec: runs.reduce((s, r) => s + r.durationSec, 0),
    currentStreak: streaks.current,
    bestStreak: streaks.best,
  };
}
