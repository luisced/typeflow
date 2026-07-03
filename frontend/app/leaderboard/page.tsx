"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ChartHelp from "@/components/ChartHelp";
import LeaderboardTable from "@/components/LeaderboardTable";
import TopBar from "@/components/TopBar";
import {
  attemptSilentRefresh,
  fetchLeaderboard,
  LEADERBOARD_BUCKETS,
  type LeaderboardBucket,
  type LeaderboardResponse,
  type LeaderboardTimeframe,
} from "@/lib/api";
import { getUser } from "@/lib/auth";
import { useTheme } from "@/lib/useTheme";

const TIMEFRAMES: { key: LeaderboardTimeframe; label: string }[] = [
  { key: "all_time", label: "All time" },
  { key: "monthly", label: "Monthly" },
];

export default function LeaderboardPage() {
  const router = useRouter();
  const { dark, toggle: toggleTheme } = useTheme();
  const [bucket, setBucket] = useState<LeaderboardBucket>(
    LEADERBOARD_BUCKETS[1]
  );
  const [timeframe, setTimeframe] = useState<LeaderboardTimeframe>("all_time");
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      await attemptSilentRefresh();
      setUsername(getUser()?.username ?? null);
      const result = await fetchLeaderboard(
        bucket.mode,
        bucket.value,
        timeframe
      );
      setData(result);
    } catch {
      setError(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [bucket, timeframe]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="profile-page">
      <div className="topbar-wrap shrink-0">
        <TopBar
          variant="profile"
          onGoHome={() => router.push("/")}
          onOpenProfile={() => router.push("/profile")}
          onOpenLeaderboard={() => router.push("/leaderboard")}
          dark={dark}
          onToggleTheme={toggleTheme}
        />
      </div>

      <main className="profile-bento">
        <div className="profile-bento-card lb-page-card">
          <div className="lb-page-header">
            <div className="lb-page-header-left">
              <h1 className="lb-page-title">Leaderboard</h1>
              <ChartHelp label="How is score calculated?" size="sm">
                Score is <strong>WPM × (accuracy ÷ 100)</strong>. Each user&apos;s
                best qualifying run in the selected bucket counts. Practice runs
                and content-flag variants are excluded.
              </ChartHelp>
            </div>
          </div>

          <div className="lb-filters">
            <div className="seg lb-bucket-seg" role="group" aria-label="Test bucket">
              {LEADERBOARD_BUCKETS.map((b) => (
                <button
                  key={`${b.mode}-${b.value}`}
                  type="button"
                  className="chip"
                  data-active={
                    bucket.mode === b.mode && bucket.value === b.value
                  }
                  onClick={() => setBucket(b)}
                >
                  {b.label}
                </button>
              ))}
            </div>
            <div className="seg lb-timeframe-seg" role="group" aria-label="Timeframe">
              {TIMEFRAMES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className="chip"
                  data-active={timeframe === t.key}
                  onClick={() => setTimeframe(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {error && !loading ? (
            <div className="profile-error-banner">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p>Couldn&apos;t load leaderboard.</p>
              <button type="button" className="ghost" onClick={() => void load()}>
                Retry
              </button>
            </div>
          ) : (
            <LeaderboardTable
              entries={data?.entries ?? []}
              yourEntry={data?.yourEntry ?? null}
              currentUsername={username}
              loading={loading}
            />
          )}
        </div>
      </main>
    </div>
  );
}
