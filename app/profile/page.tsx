"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ActivityHeatmap from "@/components/ActivityHeatmap";
import KeyAccuracyBoard from "@/components/KeyAccuracyBoard";
import { attemptSilentRefresh, fetchProfileStats, type ProfileStats } from "@/lib/api";
import { getUser } from "@/lib/auth";

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function StatCard({
  label,
  value,
  accent,
  loading,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="profile-bento-card profile-stat-card">
        <div className="profile-stat-skeleton" aria-hidden />
      </div>
    );
  }

  return (
    <div className="profile-bento-card profile-stat-card">
      <p className="profile-stat-label">{label}</p>
      <p
        className={`stat-num profile-stat-value${accent ? " text-accent" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function RetryBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="profile-error-banner">
      <p>Couldn&apos;t load profile stats.</p>
      <button type="button" className="ghost" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

function formatMemberSince(createdAt: string): string {
  const d = new Date(createdAt);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async (cancelled: () => boolean) => {
    setLoading(true);
    setError(false);
    try {
      const data = await fetchProfileStats();
      if (!cancelled()) setStats(data);
    } catch {
      if (!cancelled()) setError(true);
    } finally {
      if (!cancelled()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await attemptSilentRefresh();
      if (cancelled) return;

      const current = getUser();
      if (!current) {
        router.replace("/");
        return;
      }
      setUser(current);
      await load(() => cancelled);
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [router, load, reloadKey]);

  const summary = stats?.summary;
  const memberSince = user ? formatMemberSince(user.createdAt) : "";

  if (!user) {
    return (
      <div className="profile-page" aria-busy="true" aria-label="Loading profile" />
    );
  }

  return (
    <div className="profile-page">
      <header className="profile-top-nav">
        <button
          type="button"
          className="ghost"
          onClick={() => router.back()}
        >
          ← back to test
        </button>
        <span className="wordmark" aria-label="TypeFlow">
          <span
            className="font-display italic text-[27px] leading-none"
            style={{ color: "var(--text)" }}
          >
            Type
          </span>
          <span
            className="font-display text-[27px] leading-none"
            style={{ color: "var(--accent)" }}
          >
            Flow
          </span>
          <span className="caret-dot" aria-hidden />
        </span>
      </header>

      <main className="profile-bento">
        {error && !loading && (
          <div className="profile-bento-card profile-error-card">
            <RetryBanner onRetry={() => setReloadKey((k) => k + 1)} />
          </div>
        )}

        <div className="profile-bento-top">
          <div className="profile-bento-card profile-user-hero">
            <div className="profile-avatar" aria-hidden>
              {user ? initials(user.displayName) : ""}
            </div>
            <div className="profile-user-hero-info">
              <h1>{user?.displayName}</h1>
              <p className="profile-username">@{user?.username}</p>
              <p className="profile-email">{user?.email}</p>
              <p className="profile-member-since text-dim">
                Member since {memberSince}
              </p>
            </div>
          </div>
          <StatCard
            label="Best WPM"
            value={summary?.bestWpm ?? "—"}
            accent
            loading={loading}
          />
          <StatCard
            label="Avg WPM"
            value={summary?.avgWpm ?? "—"}
            loading={loading}
          />
          <StatCard
            label="Accuracy"
            value={summary ? `${summary.avgAccuracy}%` : "—"}
            loading={loading}
          />
          <StatCard
            label="Total Runs"
            value={summary?.totalRuns ?? "—"}
            loading={loading}
          />
        </div>

        <div className="profile-bento-card">
          <ActivityHeatmap
            dailyStats={stats?.dailyStats ?? []}
            loading={loading}
          />
        </div>

        <div className="profile-bento-bottom">
          <div className="profile-bento-card">
            <KeyAccuracyBoard
              keyAccuracy={stats?.keyAccuracy ?? {}}
              keyTrends={stats?.keyTrends ?? {}}
              loading={loading}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
