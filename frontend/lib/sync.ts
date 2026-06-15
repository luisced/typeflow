import { getAccessToken } from "./api";
import * as api from "./api";
import { getUser } from "./auth";
import {
  clearHistory,
  loadHistory,
  mergeHistory,
  replaceHistory,
} from "./storage";
import type { RunRecord } from "./types";

const SYNC_KEY = "typeflow.sync.v1";

export type SyncStatus = "idle" | "syncing" | "synced" | "offline" | "error";

export interface LoginSyncResult {
  pulledCount: number;
  localCountBefore: number;
  historyCleared: boolean;
}

const STATUS_LABEL: Record<SyncStatus, string> = {
  idle: "Sync idle",
  syncing: "Syncing",
  synced: "Synced",
  offline: "Offline — will retry when online",
  error: "Sync issue — runs still saved locally",
};

export function syncStatusLabel(status: SyncStatus): string {
  return STATUS_LABEL[status];
}

interface SyncState {
  lastPulledSeq: number;
  pendingIds: string[];
  clearEpoch: number;
  lastSyncedAt?: number | null;
}

type SyncListener = (status: SyncStatus) => void;
type LastSyncListener = (at: number | null) => void;
type PendingListener = () => void;

let status: SyncStatus = "idle";
let lastSyncedAt: number | null = null;
let lastPullStats: LoginSyncResult | null = null;
let syncError: string | null = null;
const statusListeners = new Set<SyncListener>();
const lastSyncListeners = new Set<LastSyncListener>();
const mergeListeners = new Set<() => void>();
const pendingListeners = new Set<PendingListener>();
const errorListeners = new Set<(e: string | null) => void>();

function notifyPending() {
  pendingListeners.forEach((cb) => cb());
}

export function isRunPending(id: string): boolean {
  return loadSyncState().pendingIds.includes(id);
}

export function subscribeRunPending(cb: PendingListener): () => void {
  pendingListeners.add(cb);
  return () => pendingListeners.delete(cb);
}

function setStatus(next: SyncStatus) {
  status = next;
  statusListeners.forEach((cb) => cb(next));
}

function setSyncError(err: string | null) {
  syncError = err;
  errorListeners.forEach((cb) => cb(err));
}

export function getSyncError(): string | null {
  return syncError;
}

export function subscribeSyncError(cb: (e: string | null) => void): () => void {
  errorListeners.add(cb);
  cb(syncError);
  return () => errorListeners.delete(cb);
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export function subscribeSyncStatus(cb: SyncListener): () => void {
  statusListeners.add(cb);
  cb(status);
  return () => statusListeners.delete(cb);
}

export function getLastSyncedAt(): number | null {
  return lastSyncedAt;
}

export function subscribeLastSyncedAt(cb: LastSyncListener): () => void {
  lastSyncListeners.add(cb);
  cb(lastSyncedAt);
  return () => lastSyncListeners.delete(cb);
}

export function formatLastSyncedAt(at: number | null): string {
  if (at == null) return "Not synced yet";
  const diff = Date.now() - at;
  if (diff < 60_000) {
    const secs = Math.max(1, Math.floor(diff / 1000));
    return secs === 1 ? "1 sec ago" : `${secs} sec ago`;
  }
  if (diff < 3600_000) {
    const mins = Math.floor(diff / 60_000);
    return `${mins} min ago`;
  }
  if (diff < 86_400_000) {
    const hours = Math.floor(diff / 3600_000);
    return `${hours} hr ago`;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(at));
}

function setLastSyncedAt(at: number): void {
  lastSyncedAt = at;
  const state = loadSyncState();
  state.lastSyncedAt = at;
  saveSyncState(state);
  lastSyncListeners.forEach((cb) => cb(at));
}

export function subscribeSyncMerge(cb: () => void): () => void {
  mergeListeners.add(cb);
  return () => mergeListeners.delete(cb);
}

function notifyMerge() {
  mergeListeners.forEach((cb) => cb());
}

function loadSyncState(): SyncState {
  if (typeof window === "undefined") {
    return { lastPulledSeq: 0, pendingIds: [], clearEpoch: 0, lastSyncedAt: null };
  }
  try {
    const raw = window.localStorage.getItem(SYNC_KEY);
    if (!raw) return { lastPulledSeq: 0, pendingIds: [], clearEpoch: 0, lastSyncedAt: null };
    const parsed = JSON.parse(raw) as Partial<SyncState>;
    return {
      lastPulledSeq: parsed.lastPulledSeq ?? 0,
      pendingIds: Array.isArray(parsed.pendingIds) ? parsed.pendingIds : [],
      clearEpoch: parsed.clearEpoch ?? 0,
      lastSyncedAt:
        typeof parsed.lastSyncedAt === "number" ? parsed.lastSyncedAt : null,
    };
  } catch {
    return { lastPulledSeq: 0, pendingIds: [], clearEpoch: 0, lastSyncedAt: null };
  }
}

if (typeof window !== "undefined") {
  lastSyncedAt = loadSyncState().lastSyncedAt ?? null;
}

function saveSyncState(state: SyncState): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SYNC_KEY, JSON.stringify(state));
    }
  } catch {
    /* quota / private mode */
  }
}

export function queueRun(id: string): void {
  const state = loadSyncState();
  if (!state.pendingIds.includes(id)) {
    state.pendingIds.push(id);
    saveSyncState(state);
    notifyPending();
  }
}

function runsForPending(state: SyncState): RunRecord[] {
  const history = loadHistory();
  const byId = new Map(history.map((r) => [r.id, r]));
  return state.pendingIds
    .map((id) => byId.get(id))
    .filter((r): r is RunRecord => r !== undefined);
}

export async function pushPending(): Promise<void> {
  if (!getAccessToken()) return;

  let state = loadSyncState();
  const runs = runsForPending(state);
  if (runs.length === 0) return;

  const result = await api.pushRuns(runs);
  const done = new Set([...result.accepted, ...result.skipped]);
  state = loadSyncState();
  state.pendingIds = state.pendingIds.filter((id) => !done.has(id));
  saveSyncState(state);
  notifyPending();
}

function stripSeq(run: RunRecord & { seq?: number }): RunRecord {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- strip server seq
  const { seq, ...rest } = run;
  return rest;
}

export async function pullAndMerge(): Promise<void> {
  if (!getAccessToken()) return;

  let state = loadSyncState();
  let after = state.lastPulledSeq;
  const incoming: RunRecord[] = [];
  let clearEpoch = state.clearEpoch;

  for (;;) {
    const page = await api.pullRuns(after);
    clearEpoch = Math.max(clearEpoch, page.clearEpoch);
    for (const run of page.runs) incoming.push(stripSeq(run));
    if (page.runs.length === 0 || page.nextAfter === after) break;
    after = page.nextAfter;
  }

  state = loadSyncState();

  const localBefore = loadHistory().length;

  if (clearEpoch > state.clearEpoch) {
    replaceHistory([]);
    state.lastPulledSeq = after;
    state.clearEpoch = clearEpoch;
    state.pendingIds = [];
    saveSyncState(state);
    notifyPending();
    lastPullStats = {
      pulledCount: 0,
      localCountBefore: localBefore,
      historyCleared: true,
    };
    notifyMerge();
    return;
  }
  if (incoming.length > 0) {
    mergeHistory(incoming);
    notifyMerge();
  }

  lastPullStats = {
    pulledCount: incoming.length,
    localCountBefore: localBefore,
    historyCleared: false,
  };

  state.lastPulledSeq = after;
  state.clearEpoch = clearEpoch;
  saveSyncState(state);
}

export function takeLoginSyncResult(): LoginSyncResult | null {
  const result = lastPullStats;
  lastPullStats = null;
  return result;
}

export async function syncNow(): Promise<void> {
  if (!getUser() && !getAccessToken()) {
    setStatus("idle");
    return;
  }
  if (!getAccessToken()) {
    setStatus("idle");
    return;
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    setStatus("offline");
    return;
  }

  setStatus("syncing");
  try {
    await pushPending();
    await pullAndMerge();
    setLastSyncedAt(Date.now());
    setSyncError(null);
    setStatus("synced");
  } catch (err) {
    setSyncError(err instanceof Error ? err.message : "Unknown sync error");
    setStatus("error");
  }
}

export async function onLogin(): Promise<LoginSyncResult> {
  const localCountBefore = loadHistory().length;
  lastPullStats = null;
  await syncNow();
  return (
    takeLoginSyncResult() ?? {
      pulledCount: 0,
      localCountBefore,
      historyCleared: false,
    }
  );
}

export async function clearAllHistory(): Promise<void> {
  if (getAccessToken()) {
    try {
      await api.clearServerHistory();
    } catch {
      /* offline — still clear locally */
    }
  }
  clearHistory();
  lastSyncedAt = null;
  lastSyncListeners.forEach((cb) => cb(null));
  saveSyncState({
    lastPulledSeq: 0,
    pendingIds: [],
    clearEpoch: Date.now(),
    lastSyncedAt: null,
  });
  notifyPending();
  notifyMerge();
}
