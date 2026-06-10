"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ActivityHeatmap from "@/components/ActivityHeatmap";
import ChartHelp from "@/components/ChartHelp";
import KeyboardFilterBar from "@/components/KeyboardFilterBar";
import KeyboardSettings from "@/components/KeyboardSettings";
import KeyAccuracyBoard from "@/components/KeyAccuracyBoard";
import RunHistoryList from "@/components/RunHistoryList";
import WpmProgressChart from "@/components/WpmProgressChart";
import TopBar from "@/components/TopBar";
import { attemptSilentRefresh, fetchProfileStats, type ProfileStats, type RunFilters } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { resolveKeyAccuracyLayout } from "@/lib/keyboards";
import { useKeyboards } from "@/lib/useKeyboards";
import { useTheme } from "@/lib/useTheme";

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
  helpLabel,
  help,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
  loading?: boolean;
  helpLabel: string;
  help: React.ReactNode;
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
      <div className="profile-stat-label-row">
        <p className="profile-stat-label">{label}</p>
        <ChartHelp label={helpLabel} size="sm">
          {help}
        </ChartHelp>
      </div>
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
  const { dark, toggle: toggleTheme } = useTheme();
  const { keyboards } = useKeyboards();
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [filters, setFilters] = useState<RunFilters>({});

  const load = useCallback(async (cancelled: () => boolean) => {
    setLoading(true);
    setError(false);
    try {
      const data = await fetchProfileStats(filters);
      if (!cancelled()) setStats(data);
    } catch {
      if (!cancelled()) setError(true);
    } finally {
      if (!cancelled()) setLoading(false);
    }
  }, [filters]);

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
  const keyAccuracyLayout = resolveKeyAccuracyLayout(filters, keyboards);

  if (!user) {
    return (
      <div className="profile-page" aria-busy="true" aria-label="Loading profile" />
    );
  }

  return (
    <div className="profile-page">
      <div className="topbar-wrap shrink-0">
        <TopBar
          variant="profile"
          onGoHome={() => router.push("/")}
          onOpenProfile={() => router.push("/profile")}
          dark={dark}
          onToggleTheme={toggleTheme}
        />
      </div>

      <main className="profile-bento">
        {error && !loading && (
          <div className="profile-bento-card profile-error-card">
            <RetryBanner onRetry={() => setReloadKey((k) => k + 1)} />
          </div>
        )}

        <div className="profile-bento-top">
          <div className="profile-filter-strip">
            <KeyboardFilterBar filters={filters} onChange={setFilters} />
          </div>
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
            helpLabel="What is best WPM?"
            help={
              <>
                Your highest <strong>words per minute</strong> from any single
                completed test.
              </>
            }
          />
          <StatCard
            label="Avg WPM"
            value={summary?.avgWpm ?? "—"}
            loading={loading}
            helpLabel="What is average WPM?"
            help={
              <>
                The mean WPM across <strong>all</strong> your completed tests.
              </>
            }
          />
          <StatCard
            label="Accuracy"
            value={summary ? `${summary.avgAccuracy}%` : "—"}
            loading={loading}
            helpLabel="What is accuracy?"
            help={
              <>
                Average percentage of correct keystrokes across every completed
                test.
              </>
            }
          />
          <StatCard
            label="Total Runs"
            value={summary?.totalRuns ?? "—"}
            loading={loading}
            helpLabel="What are total runs?"
            help={
              <>
                How many typing tests you&apos;ve finished and saved to your
                account.
              </>
            }
          />
        </div>

        <div className="profile-bento-card profile-keyboard-card">
          <KeyboardSettings />
        </div>

        <div className="profile-bento-card">
          <ActivityHeatmap
            dailyStats={stats?.dailyStats ?? []}
            loading={loading}
          />
        </div>

        <div className="profile-bento-card">
          <WpmProgressChart
            history={stats?.wpmHistory ?? []}
            loading={loading}
          />
        </div>

        <div className="profile-bento-bottom">
          <div className="profile-bento-card">
            <KeyAccuracyBoard
              keyAccuracy={stats?.keyAccuracy ?? {}}
              keyTrends={stats?.keyTrends ?? {}}
              loading={loading}
              layout={keyAccuracyLayout}
            />
          </div>
        </div>

        <div className="profile-bento-card profile-run-history-card">
          <RunHistoryList
            variant="page"
            refreshKey={reloadKey}
            filters={filters}
            onViewRun={(id) => router.push(`/?run=${encodeURIComponent(id)}`)}
          />
        </div>
      </main>
    </div>
  );
}
