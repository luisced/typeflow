import type { RunRecord } from "./types";

export function canReplay(record: RunRecord): boolean {
  return (record.words?.length ?? 0) > 0 && (record.keyLog?.length ?? 0) > 0;
}

export function replayDurationMs(record: RunRecord): number {
  const lastT = record.keyLog?.at(-1)?.t ?? 0;
  const fromDuration = Math.round(record.durationSec * 1000);
  return Math.max(lastT, fromDuration);
}

export function formatReplayClock(ms: number, totalMs: number): string {
  const fmt = (n: number) => (n / 1000).toFixed(1);
  return `${fmt(ms)}s / ${fmt(totalMs)}s`;
}
