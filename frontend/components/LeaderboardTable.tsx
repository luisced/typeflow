"use client";

import type { LeaderboardEntry } from "@/lib/api";

type Props = {
  entries: LeaderboardEntry[];
  yourEntry: LeaderboardEntry | null;
  currentUsername?: string | null;
  loading?: boolean;
};

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function RankBadge({ rank }: { rank: number }) {
  if (rank > 3) {
    return <span className="lb-rank">{rank}</span>;
  }
  return (
    <span className={`lb-rank lb-rank-top lb-rank-${rank}`} aria-hidden>
      {rank}
    </span>
  );
}

function Row({
  entry,
  highlight,
}: {
  entry: LeaderboardEntry;
  highlight?: boolean;
}) {
  return (
    <div
      className={`lb-row${highlight ? " lb-row-you" : ""}`}
      data-rank={entry.rank}
    >
      <div className="lb-cell lb-cell-rank">
        <RankBadge rank={entry.rank} />
      </div>
      <div className="lb-cell lb-cell-user">
        <span className="lb-display-name">{entry.displayName}</span>
        <span className="lb-username">@{entry.username}</span>
      </div>
      <div className="lb-cell lb-cell-score">
        <span className="lb-score font-display tabular-nums">{entry.score}</span>
      </div>
      <div className="lb-cell lb-cell-stat tabular-nums">{entry.wpm}</div>
      <div className="lb-cell lb-cell-stat tabular-nums">{entry.accuracy}%</div>
      <div className="lb-cell lb-cell-date text-dim">{formatDate(entry.date)}</div>
    </div>
  );
}

export default function LeaderboardTable({
  entries,
  yourEntry,
  currentUsername,
  loading,
}: Props) {
  if (loading) {
    return (
      <div className="lb-table" aria-busy="true" aria-label="Loading leaderboard">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="lb-row lb-row-skeleton" aria-hidden />
        ))}
      </div>
    );
  }

  if (entries.length === 0 && !yourEntry) {
    return (
      <div className="profile-empty">
        <p className="text-dim text-sm">
          No qualifying runs yet — finish a test in this bucket to appear here.
        </p>
      </div>
    );
  }

  const pinned =
    yourEntry &&
    !entries.some((e) => e.username === yourEntry.username);

  return (
    <div className="lb-table" role="table" aria-label="Leaderboard rankings">
      <div className="lb-header" role="row">
        <span role="columnheader">Rank</span>
        <span role="columnheader">User</span>
        <span role="columnheader">Score</span>
        <span role="columnheader">WPM</span>
        <span role="columnheader">Acc</span>
        <span role="columnheader">Date</span>
      </div>
      <div className="lb-body">
        {entries.map((entry) => (
          <Row
            key={`${entry.username}-${entry.rank}`}
            entry={entry}
            highlight={!!currentUsername && entry.username === currentUsername}
          />
        ))}
        {pinned && yourEntry && (
          <>
            <div className="lb-divider" aria-hidden>
              <span>···</span>
            </div>
            <Row entry={yourEntry} highlight />
          </>
        )}
      </div>
    </div>
  );
}
