"use client";

import { useCallback, useEffect, useState } from "react";
import { isRunPending, subscribeRunPending } from "@/lib/sync";
import { canReplay } from "@/lib/replay";
import { labelForFlagsKey } from "@/lib/contentFlags";
import { layoutLabel } from "@/lib/keyboards";
import type { CaretStyle } from "@/lib/types";
import type { TestResult } from "@/lib/useTypingTest";
import ChartHelp from "./ChartHelp";
import RunReplay from "./RunReplay";
import WpmGraph from "./WpmGraph";
import KeyHeatmap from "./KeyHeatmap";

interface Props {
  result: TestResult;
  onRetry: () => void;
  onNew: () => void;
  historical?: boolean;
  onBack?: () => void;
  caretStyle?: CaretStyle;
}

export default function Results({
  result,
  onRetry,
  onNew,
  historical,
  onBack,
  caretStyle,
}: Props) {
  const { record, isPB, prevBest } = result;
  const errors = Object.entries(record.errorMap);
  const [runPending, setRunPending] = useState(() => isRunPending(record.id));
  const [replayOpen, setReplayOpen] = useState(false);
  const showReplay = canReplay(record);

  useEffect(() => {
    const refresh = () => setRunPending(isRunPending(record.id));
    refresh();
    return subscribeRunPending(refresh);
  }, [record.id]);

  useEffect(() => {
    setReplayOpen(false);
  }, [record.id]);

  useEffect(() => {
    if (!replayOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setReplayOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [replayOpen]);

  const closeReplay = useCallback(() => setReplayOpen(false), []);

  const toggleReplay = () => {
    setReplayOpen((open) => !open);
  };

  const handleRetry = () => {
    closeReplay();
    onRetry();
  };

  const handleNew = () => {
    closeReplay();
    onNew();
  };

  const handleBack = () => {
    closeReplay();
    onBack?.();
  };

  const syncing = !historical && runPending;

  const modeLabel =
    record.mode === "practice"
      ? `${record.value}s practice`
      : record.mode === "time"
      ? `${record.value}s`
      : record.mode === "words"
      ? `${record.value} words`
      : "quote";

  return (
    <div className="results-panel flex flex-col gap-8 w-full">
      <div className="grid gap-10 md:grid-cols-[300px_1fr] md:items-start items-center w-full">
        {/* hero — aligned to top on wider screens for clearer nav separation */}
        <div className="pop results-hero flex flex-col">
          <div className="flex items-center gap-2.5 mb-4 flex-wrap">
            <span className="text-dim text-[11px] uppercase tracking-[0.2em]">
              {modeLabel}
            </span>
            {historical && (
              <span className="history-run-badge text-[10px] uppercase tracking-[0.14em] px-2 py-1 rounded-md">
                {new Date(record.date).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
            {isPB && (
              <span className="pb-badge text-[10px] font-bold uppercase tracking-[0.18em] px-2 py-1 rounded-md">
                ★ best
              </span>
            )}
            {record.flagsKey && record.flagsKey !== "base" && record.mode !== "quote" && (
              <span className="history-run-badge text-[10px] uppercase tracking-[0.14em] px-2 py-1 rounded-md">
                {labelForFlagsKey(record.flagsKey)}
              </span>
            )}
            {syncing && (
              <span className="sync-run-badge text-[10px] uppercase tracking-[0.14em] px-2 py-1 rounded-md">
                Syncing to server…
              </span>
            )}
            {(record.keyboardName || record.keyboardLayout) && (
              <span className="history-run-badge text-[10px] uppercase tracking-[0.14em] px-2 py-1 rounded-md">
                {record.keyboardName ?? "Keyboard"}
                {record.keyboardLayout
                  ? ` · ${layoutLabel(record.keyboardLayout)}`
                  : ""}
              </span>
            )}
          </div>

          <div className="flex items-end gap-3 -ml-1">
            <span
              className="results-hero-wpm stat-num text-accent"
              style={{ fontSize: "clamp(84px, 12vw, 132px)" }}
            >
              {record.wpm}
            </span>
            <span className="text-dim mb-4 text-sm uppercase tracking-[0.2em]">
              wpm
            </span>
          </div>

          <div className="flex items-baseline gap-2 mt-2">
            <span className="results-hero-acc stat-num" style={{ fontSize: 44 }}>
              {record.accuracy}
              <span className="text-dim text-xl">%</span>
            </span>
            <span className="text-dim text-xs uppercase tracking-[0.2em] ml-1">
              accuracy
            </span>
          </div>

          <p className="text-sm mt-5 leading-relaxed" style={{ minHeight: 20 }}>
            {historical ? (
              <span className="text-dim">Saved run from your history.</span>
            ) : isPB ? (
              <span className="text-accent">
                New personal best — up {record.wpm - prevBest} wpm.
              </span>
            ) : prevBest > 0 ? (
              <span className="text-dim">Personal best {prevBest} wpm.</span>
            ) : (
              <span className="text-dim">First {modeLabel} run saved.</span>
            )}
          </p>

          <div
            className="h-px my-7"
            style={{
              background:
                "linear-gradient(90deg, var(--border), transparent)",
            }}
          />

          <div className="flex gap-2.5 flex-wrap">
            {historical && onBack && (
              <button className="ghost" onClick={handleBack}>
                ← back
              </button>
            )}
            <button className="ghost" onClick={handleRetry}>
              {historical ? "retry test" : "retry ↵"}
            </button>
            {!historical && (
              <button className="ghost" onClick={handleNew}>
                new ⇥
              </button>
            )}
            {showReplay && (
              <button
                className={`ghost${replayOpen ? " ghost-active" : ""}`}
                onClick={toggleReplay}
                aria-expanded={replayOpen}
              >
                replay ▶
              </button>
            )}
          </div>
        </div>

        {/* chart + breakdown */}
        <div className="grid gap-4 rise" style={{ animationDelay: "0.1s" }}>
          <div className="panel p-6">
            <div className="wpm-chart-header mb-4">
              <span className="text-dim text-[11px] uppercase tracking-[0.2em]">
                wpm over time
              </span>
              <div className="wpm-chart-header-meta">
                <div className="wpm-chart-legend" aria-hidden>
                  <span className="wpm-chart-legend-item">
                    <span className="wpm-chart-legend-swatch wpm-chart-legend-net" />
                    net
                  </span>
                  <span className="wpm-chart-legend-item">
                    <span className="wpm-chart-legend-swatch wpm-chart-legend-raw" />
                    raw
                  </span>
                  <span className="wpm-chart-legend-item">
                    <span className="wpm-chart-legend-swatch wpm-chart-legend-avg" />
                    avg
                  </span>
                  <span className="wpm-chart-legend-item">
                    <span className="wpm-chart-legend-x">×</span>
                    error
                  </span>
                </div>
                <ChartHelp
                  label="How to read this chart"
                  title="The orange line is net WPM (correct chars only). The blue line is raw speed including mistakes. Red × marks show when errors happened. The dashed line is your average net WPM."
                >
                  The orange line is net WPM (correct chars only). The blue line
                  is raw speed including mistakes. Red × marks show when errors
                  happened. The dashed line is your average net WPM.
                </ChartHelp>
              </div>
            </div>
            <WpmGraph
              samples={record.samples}
              rawSamples={record.rawSamples}
              errorSeconds={record.errorSeconds}
            />
          </div>

          <div>
            <div className="stats-row-header">
              <span className="text-dim text-[11px] uppercase tracking-[0.2em]">
                run stats
              </span>
              <ChartHelp
                label="What these stats mean"
                title="Raw counts all typed characters. Consistency measures pacing steadiness. Time is total run duration."
              >
                <strong>Raw</strong> — speed including mistakes.{" "}
                <strong>Consistency</strong> — how steady your pacing was (100%
                is perfectly even). <strong>Time</strong> — how long the run
                lasted.
              </ChartHelp>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Stat label="raw" value={record.raw} />
              <Stat label="consistency" value={`${record.consistency}%`} />
              <Stat label="time" value={`${record.durationSec}s`} />
            </div>
          </div>

          <div className="panel p-6">
            <div className="text-dim text-[11px] uppercase tracking-[0.2em] mb-5">
              most-missed keys
            </div>
            {errors.length > 0 ? (
              <KeyHeatmap errorMap={record.errorMap} />
            ) : (
              <div className="flex items-center gap-3 py-1">
                <span className="text-accent text-lg leading-none" aria-hidden>
                  ✓
                </span>
                <span className="text-dim text-sm">
                  Clean run — no missed keys.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {replayOpen && showReplay && (
        <RunReplay record={record} caretStyle={caretStyle} />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="panel p-5">
      <div className="stat-num" style={{ fontSize: 34 }}>
        {value}
      </div>
      <div className="text-dim text-[10px] uppercase tracking-[0.18em] mt-1.5">
        {label}
      </div>
    </div>
  );
}
