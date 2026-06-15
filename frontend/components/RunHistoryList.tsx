"use client";

import { useEffect, useState } from "react";
import ChartHelp from "@/components/ChartHelp";
import KeyboardFilterBar from "@/components/KeyboardFilterBar";
import { fetchRunSummaries, getAccessToken, type RunFilters, type RunSummary } from "@/lib/api";
import { layoutLabel } from "@/lib/keyboards";
import { isOnline } from "@/lib/network";
import { filterSummaries, flagsLabel, modeLabel, summariesFromLocal } from "@/lib/runDisplay";
import { clearAllHistory } from "@/lib/sync";

interface Props {
  onViewRun: (id: string) => void;
  onRunsChange?: (runs: RunSummary[]) => void;
  refreshKey?: number;
  active?: boolean;
  variant?: "panel" | "page";
  showClear?: boolean;
  filters?: RunFilters;
  onFiltersChange?: (filters: RunFilters) => void;
  showFilters?: boolean;
}

function RunRow({
  run,
  onViewRun,
  variant,
}: {
  run: RunSummary;
  onViewRun: (id: string) => void;
  variant: "panel" | "page";
}) {
  const wpmSize = variant === "page" ? 26 : 22;

  return (
    <button
      type="button"
      className={`profile-run-row${variant === "page" ? " profile-run-row-page" : ""}`}
      onClick={() => onViewRun(run.id)}
    >
      <div className="profile-run-wpm">
        <span
          className="font-display text-accent"
          style={{ fontSize: wpmSize }}
        >
          {run.wpm}
        </span>
        <span className="text-dim text-[10px] ml-1">wpm</span>
      </div>
      <div className="profile-run-meta">
        <span>{run.accuracy}%</span>
        <span>·</span>
        <span>{modeLabel(run)}</span>
        {flagsLabel(run) && (
          <>
            <span>·</span>
            <span>{flagsLabel(run)}</span>
          </>
        )}
        <span>·</span>
        <span>{run.consistency}%</span>
        {(run.keyboardName || run.keyboardLayout) && (
          <>
            <span>·</span>
            <span>
              {run.keyboardName ?? "—"}
              {run.keyboardLayout ? ` · ${layoutLabel(run.keyboardLayout)}` : ""}
            </span>
          </>
        )}
      </div>
      <div className="profile-run-date">
        {new Date(run.date).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })}
        <br />
        {new Date(run.date).toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>
      <span className="profile-run-chevron" aria-hidden>
        ›
      </span>
    </button>
  );
}

export default function RunHistoryList({
  onViewRun,
  onRunsChange,
  refreshKey = 0,
  active = true,
  variant = "panel",
  showClear = true,
  filters,
  onFiltersChange,
  showFilters = false,
}: Props) {
  const [listKey, setListKey] = useState(0);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [offlineBanner, setOfflineBanner] = useState(false);
  const [errorBanner, setErrorBanner] = useState(false);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;

    const load = async () => {
      setErrorBanner(false);
      setOfflineBanner(false);

      if (!isOnline() || !getAccessToken()) {
        setRuns(filterSummaries(summariesFromLocal(), filters));
        if (!isOnline()) setOfflineBanner(true);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const summaries = await fetchRunSummaries(filters);
        if (cancelled) return;
        setRuns(summaries);
      } catch {
        if (cancelled) return;
        setRuns(filterSummaries(summariesFromLocal(), filters));
        setErrorBanner(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [active, refreshKey, listKey, filters?.keyboardId, filters?.layout]);

  useEffect(() => {
    onRunsChange?.(runs);
  }, [runs, onRunsChange]);

  const header =
    variant === "page" ? (
      <div className="run-history-header">
        <div className="run-history-header-left">
          <h2 className="run-history-title">Run history</h2>
          <ChartHelp label="What is run history?" size="sm">
            Every completed test you&apos;ve saved. Click a run to open its full
            results — WPM chart, stats, and key heatmap.
          </ChartHelp>
        </div>
        {showClear && runs.length > 0 && !loading && (
          <button
            type="button"
            className="ghost text-error run-history-clear"
            onClick={async () => {
              try {
                await clearAllHistory();
              } catch {
                /* offline — still cleared locally */
              }
              setListKey((k) => k + 1);
            }}
          >
            clear
          </button>
        )}
      </div>
    ) : (
      <div className="flex items-center justify-between px-6 mb-3">
        <span className="text-[10px] uppercase tracking-[0.16em] text-dim">
          Run history
        </span>
        {showClear && runs.length > 0 && !loading && (
          <button
            type="button"
            className="ghost text-error"
            style={{ fontSize: 11, padding: "4px 8px" }}
            onClick={async () => {
              try {
                await clearAllHistory();
              } catch {
                /* offline — still cleared locally */
              }
              setListKey((k) => k + 1);
            }}
          >
            clear
          </button>
        )}
      </div>
    );

  const banner =
    offlineBanner || errorBanner ? (
      <p
        className={
          variant === "page"
            ? "run-history-banner"
            : "px-6 mb-3 text-[11px] text-dim"
        }
      >
        {offlineBanner
          ? "Offline — showing cached runs"
          : "Could not load from server — showing cached runs"}
      </p>
    ) : null;

  const listBody = loading ? (
    <div className="space-y-2" aria-busy="true">
      {Array.from({ length: variant === "page" ? 6 : 5 }).map((_, i) => (
        <div key={i} className="profile-run-row profile-run-skeleton" />
      ))}
    </div>
  ) : runs.length === 0 ? (
    <div className="profile-empty">
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        aria-hidden
        style={{ color: "var(--text-faint)" }}
      >
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
        <RunRow key={r.id} run={r} onViewRun={onViewRun} variant={variant} />
      ))}
    </div>
  );

  const filtersEl =
    showFilters && onFiltersChange ? (
      <div className={variant === "page" ? "run-history-filters" : "px-6 mb-3"}>
        <KeyboardFilterBar filters={filters ?? {}} onChange={onFiltersChange} />
      </div>
    ) : null;

  if (variant === "page") {
    return (
      <section className="run-history-page" aria-label="Run history">
        {header}
        {filtersEl}
        {banner}
        <div className="run-history-scroll">{listBody}</div>
      </section>
    );
  }

  return (
    <>
      {header}
      {filtersEl}
      {banner}
      <div className="px-6 pb-8">{listBody}</div>
    </>
  );
}
