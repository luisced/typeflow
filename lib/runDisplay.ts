import type { RunSummary } from "@/lib/api";
import { loadHistory } from "@/lib/storage";

export function modeLabel(r: { mode: string; value: number }): string {
  return r.mode === "time"
    ? `${r.value}s`
    : r.mode === "words"
      ? `${r.value}w`
      : "quote";
}

export function summariesFromLocal(): RunSummary[] {
  return loadHistory().map((r) => ({
    id: r.id,
    mode: r.mode,
    value: r.value,
    wpm: r.wpm,
    accuracy: r.accuracy,
    consistency: r.consistency,
    durationSec: r.durationSec,
    date: r.date,
    keyboardId: r.keyboardId,
    keyboardName: r.keyboardName,
    keyboardLayout: r.keyboardLayout,
  }));
}

export function filterSummaries(
  runs: RunSummary[],
  filters?: { keyboardId?: string; layout?: string }
): RunSummary[] {
  if (!filters?.keyboardId && !filters?.layout) return runs;
  return runs.filter((r) => {
    if (filters.keyboardId && r.keyboardId !== filters.keyboardId) return false;
    if (filters.layout && r.keyboardLayout !== filters.layout) return false;
    return true;
  });
}
