"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchRunSummaries, getAccessToken, type RunSummary } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { isOnline } from "@/lib/network";
import { loadHistory } from "@/lib/storage";
import {
  clearAllHistory,
  formatLastSyncedAt,
  getLastSyncedAt,
  getSyncStatus,
  subscribeLastSyncedAt,
  subscribeSyncStatus,
  type SyncStatus,
} from "@/lib/sync";

const STATUS_COLOR: Record<SyncStatus, string> = {
  idle: "var(--text-faint)",
  syncing: "var(--accent)",
  synced: "var(--success)",
  offline: "var(--text-dim)",
  error: "var(--error)",
};

interface Props {
  open: boolean;
  onClose: () => void;
  onViewRun: (id: string) => void;
  refreshKey: number;
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function modeLabel(r: { mode: string; value: number }) {
  return r.mode === "time"
    ? `${r.value}s`
    : r.mode === "words"
      ? `${r.value}w`
      : "quote";
}

function summariesFromLocal(): RunSummary[] {
  return loadHistory().map((r) => ({
    id: r.id,
    mode: r.mode,
    value: r.value,
    wpm: r.wpm,
    accuracy: r.accuracy,
    consistency: r.consistency,
    durationSec: r.durationSec,
    date: r.date,
  }));
}

export default function ProfilePanel({
  open,
  onClose,
  onViewRun,
  refreshKey,
}: Props) {
  const router = useRouter();
  const user = getUser();
  const [, bump] = useState(0);
  const [syncStatus, setSyncStatus] = useState(getSyncStatus);
  const [lastSyncedAt, setLastSyncedAt] = useState(getLastSyncedAt);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [offlineBanner, setOfflineBanner] = useState(false);
  const [errorBanner, setErrorBanner] = useState(false);

  useEffect(() => subscribeSyncStatus(setSyncStatus), []);
  useEffect(() => subscribeLastSyncedAt(setLastSyncedAt), []);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const load = async () => {
      setErrorBanner(false);
      setOfflineBanner(false);

      if (!isOnline() || !getAccessToken()) {
        setRuns(summariesFromLocal());
        if (!isOnline()) setOfflineBanner(true);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const summaries = await fetchRunSummaries();
        if (cancelled) return;
        setRuns(summaries);
      } catch {
        if (cancelled) return;
        setRuns(summariesFromLocal());
        setErrorBanner(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, refreshKey]);

  const best = runs.reduce((m, r) => Math.max(m, r.wpm), 0);
  const avg = runs.length
    ? Math.round(runs.reduce((s, r) => s + r.wpm, 0) / runs.length)
    : 0;

  return (
    <>
      {/* scrim */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{
          background: "rgba(26,24,20,0.35)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          backdropFilter: open ? "blur(2px)" : "none",
        }}
        onClick={onClose}
        aria-hidden
      />

      {/* panel */}
      <aside
        className="fixed top-0 right-0 z-50 h-full overflow-y-auto transition-transform duration-300"
        style={{
          width: 420,
          maxWidth: "92vw",
          background: "var(--bg)",
          borderLeft: "1px solid var(--border)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          boxShadow: "-12px 0 48px -12px rgba(0,0,0,0.18)",
        }}
        aria-label="Profile & history"
        role="complementary"
      >
        {/* top bar */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <span className="text-[10px] uppercase tracking-[0.16em] text-dim">
            Profile
          </span>
          <button className="ghost" onClick={onClose} aria-label="Close profile">
            ✕
          </button>
        </div>

        {/* user card */}
        {user && (
          <div className="profile-user-card mx-6 mb-6">
            <div className="profile-avatar" aria-hidden>
              {initials(user.displayName)}
            </div>
            <div className="profile-user-info">
              <p className="profile-display-name">{user.displayName}</p>
              <p className="profile-username">@{user.username}</p>
              <p className="profile-email">{user.email}</p>
            </div>

            {/* sync row */}
            <div className="profile-sync-row">
              <span
                className={`sync-dot sync-dot-inline${syncStatus === "syncing" ? " sync-dot-pulse" : ""}`}
                style={{ background: STATUS_COLOR[syncStatus] }}
                aria-hidden
              />
              <span className="text-[11px] text-dim">
                {syncStatus === "syncing" ? "Syncing…" : syncStatus === "synced" ? "Synced" : syncStatus === "offline" ? "Offline" : syncStatus === "error" ? "Sync error" : "Idle"}
              </span>
              <span className="text-[10px] text-faint ml-auto">
                {formatLastSyncedAt(lastSyncedAt)}
              </span>
            </div>

            <button
              type="button"
              className="profile-view-full"
              onClick={() => {
                onClose();
                router.push("/profile");
              }}
            >
              View full profile →
            </button>
          </div>
        )}

        {/* stats bar */}
        <div className="grid grid-cols-3 gap-3 mx-6 mb-6">
          <StatCard label="best wpm" value={best || "—"} accent />
          <StatCard label="avg wpm" value={avg || "—"} />
          <StatCard label="runs" value={runs.length} />
        </div>

        {/* divider */}
        <div
          className="mx-6 mb-5"
          style={{ height: 1, background: "var(--border-soft)" }}
        />

        {/* history label */}
        <div className="flex items-center justify-between px-6 mb-3">
          <span className="text-[10px] uppercase tracking-[0.16em] text-dim">
            Run history
          </span>
          {runs.length > 0 && !loading && (
            <button
              className="ghost text-error"
              style={{ fontSize: 11, padding: "4px 8px" }}
              onClick={async () => {
                try {
                  await clearAllHistory();
                } catch {/* offline — still cleared locally */}
                bump((v) => v + 1);
              }}
            >
              clear
            </button>
          )}
        </div>

        {(offlineBanner || errorBanner) && (
          <p className="px-6 mb-3 text-[11px] text-dim">
            {offlineBanner
              ? "Offline — showing cached runs"
              : "Could not load from server — showing cached runs"}
          </p>
        )}

        {/* run list */}
        <div className="px-6 pb-8">
          {loading ? (
            <div className="space-y-2" aria-busy="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="profile-run-row profile-run-skeleton" />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <div className="profile-empty">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden style={{ color: "var(--text-faint)" }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <p className="text-dim text-sm mt-3">
                No runs yet — finish a test and it shows up here.
              </p>
            </div>
          ) : (
            <div key={refreshKey} className="space-y-2">
              {runs.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="profile-run-row"
                  onClick={() => onViewRun(r.id)}
                >
                  <div className="profile-run-wpm">
                    <span className="font-display text-accent" style={{ fontSize: 22 }}>
                      {r.wpm}
                    </span>
                    <span className="text-dim text-[10px] ml-1">wpm</span>
                  </div>
                  <div className="profile-run-meta">
                    <span>{r.accuracy}%</span>
                    <span>·</span>
                    <span>{modeLabel(r)}</span>
                    <span>·</span>
                    <span>{r.consistency}%</span>
                  </div>
                  <div className="profile-run-date">
                    {new Date(r.date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                    <br />
                    {new Date(r.date).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <span className="profile-run-chevron" aria-hidden>
                    ›
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div className="panel p-4 text-center">
      <div
        className="stat-num leading-none"
        style={{
          fontSize: 28,
          color: accent ? "var(--accent)" : undefined,
        }}
      >
        {value}
      </div>
      <div className="text-dim text-[9px] uppercase tracking-[0.14em] mt-1.5">
        {label}
      </div>
    </div>
  );
}
