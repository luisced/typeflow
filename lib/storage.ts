import type { RunRecord } from "./types";

const KEY = "typeflow.history.v1";
const LIMIT = 1000;

function persist(history: RunRecord[]): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, JSON.stringify(history));
    }
  } catch {
    // private mode / quota — keep working, just don't persist
  }
}

function sortAndCap(runs: RunRecord[]): RunRecord[] {
  return [...runs].sort((a, b) => b.date - a.date).slice(0, LIMIT);
}

export function loadHistory(): RunRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RunRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveRun(run: RunRecord): RunRecord[] {
  const history = sortAndCap([run, ...loadHistory()]);
  persist(history);
  return history;
}

/** Union-merge by id, newest first, capped at LIMIT. */
export function mergeHistory(incoming: RunRecord[]): RunRecord[] {
  const byId = new Map<string, RunRecord>();
  for (const r of loadHistory()) byId.set(r.id, r);
  for (const r of incoming) byId.set(r.id, r);
  const history = sortAndCap([...byId.values()]);
  persist(history);
  return history;
}

/** Replace entire history (e.g. after server clear-epoch). */
export function replaceHistory(runs: RunRecord[]): RunRecord[] {
  const history = sortAndCap(runs);
  persist(history);
  return history;
}

/**
 * Personal best WPM for a given mode+value, excluding the given run id.
 * Quote mode has no meaningful `value` (quotes vary in length), so all
 * quote runs share one PB bucket regardless of stored value.
 */
export function personalBest(
  history: RunRecord[],
  mode: string,
  value: number,
  excludeId?: string
): number {
  return history
    .filter(
      (r) =>
        r.mode === mode &&
        (mode === "quote" || r.value === value) &&
        r.id !== excludeId
    )
    .reduce((best, r) => Math.max(best, r.wpm), 0);
}

export function clearHistory() {
  try {
    if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
  } catch {
    /* no-op */
  }
}
