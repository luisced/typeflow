"use client";

import { useEffect, useId, useState } from "react";
import ChartHelp from "@/components/ChartHelp";
import { layoutLabel, layoutRows } from "@/lib/keyboards";
import type { KeyboardLayout } from "@/lib/types";

interface Props {
  keyAccuracy: Record<string, number>;
  keyTrends: Record<string, number[]>;
  loading?: boolean;
  layout?: KeyboardLayout;
}

function keyDisplay(ch: string): string {
  if (ch === " ") return "";
  return ch;
}

function accuracyStyle(pct: number | undefined): React.CSSProperties {
  if (pct === undefined) {
    return {
      background: "var(--border)",
      color: "var(--text-faint)",
    };
  }
  if (pct >= 93) {
    return {
      background: "rgba(60, 180, 80, 0.35)",
      borderColor: "rgba(60, 180, 80, 0.55)",
      color: "var(--text)",
    };
  }
  if (pct >= 85) {
    return {
      background: "rgba(230, 170, 40, 0.35)",
      borderColor: "rgba(230, 170, 40, 0.55)",
      color: "var(--text)",
    };
  }
  return {
    background: "rgba(192, 57, 43, 0.35)",
    borderColor: "rgba(192, 57, 43, 0.55)",
    color: "var(--text)",
  };
}

function TrendChart({ data }: { data: number[] }) {
  const gradientId = useId();
  const W = 300;
  const H = 96;
  const PAD = { l: 4, r: 8, t: 6, b: 6 };
  const Y_MIN = 60;
  const Y_MAX = 100;
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const x = (i: number) =>
    PAD.l + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => {
    const clamped = Math.max(Y_MIN, Math.min(Y_MAX, v));
    const t = (clamped - Y_MIN) / (Y_MAX - Y_MIN);
    return PAD.t + innerH - t * innerH;
  };

  const line = data.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
  const area = `${line} L ${x(data.length - 1)} ${PAD.t + innerH} L ${x(0)} ${PAD.t + innerH} Z`;
  const last = data[data.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="key-trend-chart"
      role="img"
      aria-label="Key accuracy trend over recent runs"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={x(data.length - 1)} cy={y(last)} r="3.5" fill="var(--accent)" />
    </svg>
  );
}

export default function KeyAccuracyBoard({
  keyAccuracy,
  keyTrends,
  loading,
  layout = "qwerty",
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const rows = layoutRows(layout);

  useEffect(() => {
    setSelected(null);
  }, [layout]);

  const hasData = Object.keys(keyAccuracy).length > 0;
  const trend = selected ? keyTrends[selected] : undefined;
  const current = selected ? keyAccuracy[selected] : undefined;
  const hasTrend = trend !== undefined && trend.length >= 2;

  const KeyButton = ({ ch }: { ch: string }) => {
    const pct = keyAccuracy[ch];
    const keyName = ch === " " ? "space" : ch;
    const label =
      pct !== undefined
        ? `${keyName} key — ${pct}% accuracy`
        : `${keyName} key`;
    const isSelected = selected === ch;
    const isSpace = ch === " ";

    return (
      <button
        type="button"
        className={`kbd-key${isSpace ? " kbd-space" : ""}${isSelected ? " kbd-key-selected" : ""}`}
        style={accuracyStyle(pct)}
        aria-label={label}
        title={pct !== undefined ? `${pct}% accuracy` : undefined}
        aria-pressed={isSelected}
        onClick={() => setSelected(ch)}
      >
        {!isSpace && <span>{keyDisplay(ch)}</span>}
      </button>
    );
  };

  const renderTrendPanel = () => {
    if (loading) {
      return <p className="key-trend-empty">Loading key accuracy…</p>;
    }

    if (!hasData) {
      return (
        <p className="key-trend-empty">
          Key accuracy available after your next test
        </p>
      );
    }

    if (!selected) {
      return (
        <p className="key-trend-empty">
          Click a key to see its accuracy over time.
        </p>
      );
    }

    if (!hasTrend) {
      return (
        <p className="key-trend-empty">
          Not enough data yet — keep typing to build a trend.
        </p>
      );
    }

    const best = Math.max(...trend!);
    const worst = Math.min(...trend!);
    const delta = trend![trend!.length - 1] - trend![0];
    const deltaLabel =
      delta >= 0 ? `↑ +${delta}%` : `↓ ${Math.abs(delta)}%`;

    return (
      <div className="key-trend-content">
        <div className="key-trend-header">
          <span className="key-trend-badge">{selected.toUpperCase()}</span>
          <span className="key-trend-current">{current}%</span>
          <span className="key-trend-delta">{deltaLabel}</span>
        </div>
        <TrendChart data={trend!} />
        <div className="key-trend-stats">
          <span>Best {best}</span>
          <span>Worst {worst}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="key-accuracy-board">
      <div className="key-accuracy-header">
        <div className="key-accuracy-title-row">
          <h3 className="key-accuracy-title">Key accuracy</h3>
          <span className="key-accuracy-layout">{layoutLabel(layout)}</span>
        </div>
        <ChartHelp label="What is key accuracy?" size="sm">
          <>
            Each key is colored by how often you type it correctly.{" "}
            <strong>Green</strong> is high accuracy, <strong>red</strong> is low.
            Select a key to see how your accuracy on that key has changed across
            recent tests.
          </>
        </ChartHelp>
      </div>
      <div className="key-accuracy-keyboard" data-layout={layout}>
        {rows.map((row, ri) => (
          <div key={ri} className="flex gap-2" style={{ marginLeft: ri * 20 }}>
            {row.map((ch, ci) => (
              <KeyButton key={`${ri}-${ci}-${ch}`} ch={ch} />
            ))}
          </div>
        ))}
        <KeyButton ch=" " />
      </div>
      <div className="key-trend-panel">{renderTrendPanel()}</div>
    </div>
  );
}
