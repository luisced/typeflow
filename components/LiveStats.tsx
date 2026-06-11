"use client";

import type { Mode } from "@/lib/types";

interface Props {
  mode: Mode;
  remaining: number | null;
  wpm: number;
  accuracy: number;
  elapsed: number;
  progress: string; // e.g. "12/25"
  visible: boolean;
  ghostAhead?: number | null;
  ghostAccuracy?: number | null;
  ghostMistakes?: number | null;
}

export default function LiveStats({
  mode,
  remaining,
  wpm,
  accuracy,
  elapsed,
  progress,
  visible,
  ghostAhead,
  ghostAccuracy,
  ghostMistakes,
}: Props) {
  const showWpm = elapsed >= 3;

  return (
    <div
      className="flex items-center gap-6 h-7 transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {mode === "time" || mode === "practice" ? (
        <Metric value={Math.ceil(remaining ?? 0).toString()} label="left" big />
      ) : (
        <Metric value={progress} label="words" big />
      )}
      <Metric
        value={showWpm ? wpm.toString() : "—"}
        label="wpm"
        muted={!showWpm}
      />
      <Metric
        value={elapsed < 1 ? "—" : `${accuracy}%`}
        label="acc"
        muted={elapsed < 1}
      />
      {ghostAhead != null && elapsed >= 1 && (
        <Metric
          value={ghostAhead > 0 ? `+${ghostAhead}` : ghostAhead.toString()}
          label="vs ghost"
          muted={ghostAhead === 0}
        />
      )}
      {ghostAccuracy != null && elapsed >= 1 && (
        <Metric
          value={`${ghostAccuracy}%`}
          label="ghost acc"
          muted={ghostAccuracy === 100}
        />
      )}
      {ghostMistakes != null && ghostMistakes > 0 && elapsed >= 1 && (
        <Metric
          value={ghostMistakes.toString()}
          label={ghostMistakes === 1 ? "ghost miss" : "ghost misses"}
        />
      )}
    </div>
  );
}

function Metric({
  value,
  label,
  big,
  muted,
}: {
  value: string;
  label: string;
  big?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1.5" style={{ opacity: muted ? 0.35 : 1, transition: "opacity 0.4s ease" }}>
      <span
        className="font-display tabular-nums"
        style={{
          color: big ? "var(--accent)" : "var(--text-dim)",
          fontSize: big ? 24 : 20,
        }}
      >
        {value}
      </span>
      <span className="text-dim text-[11px] uppercase tracking-widest">
        {label}
      </span>
    </div>
  );
}
