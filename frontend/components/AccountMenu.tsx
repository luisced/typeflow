"use client";

import { useEffect, useRef, useState } from "react";
import { deleteAccount, logout } from "@/lib/api";
import { getUser, subscribe } from "@/lib/auth";
import {
  formatLastSyncedAt,
  getLastSyncedAt,
  getSyncError,
  getSyncStatus,
  subscribeLastSyncedAt,
  subscribeSyncError,
  subscribeSyncStatus,
  syncStatusLabel,
  type SyncStatus,
} from "@/lib/sync";

const MENU_ICONS = {
  profile: (
    <>
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="8" r="4" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </>
  ),
  delete: (
    <>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </>
  ),
} as const;

function MenuIcon({ name }: { name: keyof typeof MENU_ICONS }) {
  return (
    <svg
      className="account-menu-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {MENU_ICONS[name]}
    </svg>
  );
}

const STATUS_COLOR: Record<SyncStatus, string> = {
  idle: "var(--text-faint)",
  syncing: "var(--accent)",
  synced: "var(--success)",
  offline: "var(--text-dim)",
  error: "var(--error)",
};

interface AccountMenuProps {
  onOpenProfile: () => void;
  onSignIn?: () => void;
}

export default function AccountMenu({ onOpenProfile, onSignIn }: AccountMenuProps) {
  const [user, setUser] = useState(getUser);
  const [syncStatus, setSyncStatus] = useState(getSyncStatus);
  const [lastSyncedAt, setLastSyncedAt] = useState(getLastSyncedAt);
  const [syncError, setSyncError] = useState(getSyncError);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => subscribe(() => setUser(getUser())), []);
  useEffect(() => subscribeSyncStatus(setSyncStatus), []);
  useEffect(() => subscribeLastSyncedAt(setLastSyncedAt), []);
  useEffect(() => subscribeSyncError(setSyncError), []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [open]);

  if (!user) {
    if (!onSignIn) return null;
    return (
      <button className="ghost" onClick={onSignIn}>
        sign in
      </button>
    );
  }

  const dotLabel = syncStatusLabel(syncStatus);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
  };

  const handleDelete = async () => {
    if (!confirm("Delete your account and all synced history? This cannot be undone.")) {
      return;
    }
    setBusy(true);
    try {
      await deleteAccount();
      setOpen(false);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        className={`ghost${open ? " ghost-active" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span
          className={`sync-dot${syncStatus === "syncing" ? " sync-dot-pulse" : ""}`}
          style={{ background: STATUS_COLOR[syncStatus] }}
          aria-hidden
        />
        <span className="sr-only">{dotLabel}</span>
        <span className="truncate max-w-[140px]">@{user.username}</span>
      </button>

      {open && (
        <div className="settings-pop account-pop" role="menu">
          <div className="settings-label">account</div>
          <p className="text-sm mb-0.5">{user.displayName}</p>
          <p className="text-dim text-xs mb-0.5">@{user.username}</p>
          <p className="text-dim text-xs mb-2 break-all">{user.email}</p>
          <div className="account-sync-meta mb-3" aria-live="polite">
            <p className="sync-legend-inline text-[11px]">
              <span
                className={`sync-dot sync-dot-inline${syncStatus === "syncing" ? " sync-dot-pulse" : ""}`}
                style={{ background: STATUS_COLOR[syncStatus] }}
                aria-hidden
              />
              {dotLabel}
            </p>
            <p className="account-last-sync text-[10px]">
              Last sync from server: {formatLastSyncedAt(lastSyncedAt)}
            </p>
            {syncStatus === "error" && syncError && (
              <p className="text-[10px] mt-1" style={{ color: "var(--error)" }}>
                {syncError}
              </p>
            )}
          </div>
          <div className="account-menu-actions">
            <button
              className="ghost account-menu-btn"
              role="menuitem"
              onClick={() => { setOpen(false); onOpenProfile(); }}
            >
              <MenuIcon name="profile" />
              profile &amp; history
            </button>
            <button className="ghost account-menu-btn" role="menuitem" onClick={handleLogout}>
              <MenuIcon name="logout" />
              log out
            </button>
            <button
              className="ghost account-menu-btn account-menu-btn-danger"
              role="menuitem"
              onClick={handleDelete}
              disabled={busy}
            >
              <MenuIcon name="delete" />
              delete account
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
