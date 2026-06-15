"use client";

import { useId, useRef, useState } from "react";
import ChartHelp from "@/components/ChartHelp";
import type { WpmHistoryPoint } from "@/lib/api";

interface Props {
  history: WpmHistoryPoint[];
  loading?: boolean;
}

const W = 900;
const H = 220;
const PAD = { l: 40, r: 16, t: 18, b: 28 };

function formatRunDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDelta(first: number, last: number): string {
  const diff = last - first;
  if (diff === 0) return "±0";
  return diff > 0 ? `↑ +${diff}` : `↓ ${diff}`;
}

export default function WpmProgressChart({ history, loading }: Props) {
  const gradientId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const tooltipId = useId();

  if (loading) {
    return (
      <section className="wpm-progress" aria-busy="true" aria-label="Loading WPM progress">
        <div className="wpm-progress-header">
          <h2 className="wpm-progress-title">WPM progress</h2>
        </div>
        <div className="wpm-progress-skeleton" aria-hidden />
      </section>
    );
  }

  const data = history.map((p) => p.wpm);
  const hasTrend = data.length >= 2;
  const max = Math.max(40, ...data, 1) * 1.12;
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const x = (i: number) =>
    PAD.l + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => PAD.t + innerH - (v / max) * innerH;

  const line = data.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
  const area =
    data.length > 0
      ? `${line} L ${x(data.length - 1)} ${PAD.t + innerH} L ${x(0)} ${PAD.t + innerH} Z`
      : "";

  const avg =
    data.length > 0 ? data.reduce((a, b) => a + b, 0) / data.length : 0;
  const gridLines = [0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));

  const indexFromClientX = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || data.length === 0) return null;
    const plotLeft = (PAD.l / W) * rect.width;
    const plotWidth = (innerW / W) * rect.width;
    const relX = clientX - rect.left - plotLeft;
    if (relX < 0 || relX > plotWidth) return null;
    if (data.length <= 1) return 0;
    const ratio = relX / plotWidth;
    return Math.min(data.length - 1, Math.max(0, Math.round(ratio * (data.length - 1))));
  };

  const hoveredPoint =
    hovered !== null && history[hovered]
      ? {
          index: hovered,
          wpm: data[hovered],
          date: history[hovered].finishedAt,
          px: (x(hovered) / W) * 100,
          py: (y(data[hovered]) / H) * 100,
        }
      : null;

  const latest = data[data.length - 1];
  const first = data[0];
  const best = data.length ? Math.max(...data) : 0;

  return (
    <section className="wpm-progress" aria-label="WPM progress over time">
      <div className="wpm-progress-header">
        <div className="wpm-progress-header-left">
          <h2 className="wpm-progress-title">WPM progress</h2>
          <ChartHelp label="What is WPM progress?" size="sm">
            Your <strong>words per minute</strong> from each completed test,
            oldest to newest. Hover a point to see when that run happened.
          </ChartHelp>
        </div>
        {hasTrend && (
          <div className="wpm-progress-meta">
            <span className="wpm-progress-meta-item">
              <span className="wpm-progress-meta-label">latest</span>
              <span className="wpm-progress-meta-value text-accent">{latest}</span>
            </span>
            <span className="wpm-progress-meta-item">
              <span className="wpm-progress-meta-label">best</span>
              <span className="wpm-progress-meta-value">{best}</span>
            </span>
            <span className="wpm-progress-meta-item">
              <span className="wpm-progress-meta-label">change</span>
              <span className="wpm-progress-meta-value">{formatDelta(first, latest)}</span>
            </span>
          </div>
        )}
      </div>

      {!hasTrend ? (
        <p className="wpm-progress-empty">
          Finish at least two tests to see how your speed is trending.
        </p>
      ) : (
        <div
          ref={wrapRef}
          className="wpm-chart-wrap wpm-progress-chart"
          onMouseMove={(e) => setHovered(indexFromClientX(e.clientX))}
          onMouseLeave={() => setHovered(null)}
          role="img"
          aria-label="Words per minute across completed tests. Hover to inspect each run."
          aria-describedby={hoveredPoint ? tooltipId : undefined}
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full block"
            style={{ aspectRatio: `${W} / ${H}` }}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {gridLines.map((g, i) => (
              <g key={i}>
                <line
                  x1={PAD.l}
                  x2={W - PAD.r}
                  y1={y(g)}
                  y2={y(g)}
                  stroke="var(--border-soft)"
                  strokeWidth="1"
                />
                <text
                  x={PAD.l - 8}
                  y={y(g) + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill="var(--text-faint)"
                  fontFamily="var(--font-sans)"
                >
                  {g}
                </text>
              </g>
            ))}

            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y(avg)}
              y2={y(avg)}
              stroke="var(--cool)"
              strokeWidth="1"
              strokeDasharray="3 4"
              opacity="0.5"
            />

            <path d={area} fill={`url(#${gradientId})`} />
            <path
              d={line}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {hoveredPoint && (
              <line
                x1={x(hoveredPoint.index)}
                x2={x(hoveredPoint.index)}
                y1={PAD.t}
                y2={PAD.t + innerH}
                stroke="var(--accent)"
                strokeWidth="1"
                opacity="0.35"
              />
            )}

            {data.map((v, i) => (
              <circle
                key={i}
                cx={x(i)}
                cy={y(v)}
                r={hovered === i ? 4.5 : 2}
                fill="var(--accent)"
                opacity={hovered === null || hovered === i ? 1 : 0.45}
              />
            ))}

            <rect
              x={PAD.l}
              y={PAD.t}
              width={innerW}
              height={innerH}
              fill="transparent"
              style={{ cursor: "crosshair" }}
            />
          </svg>

          {hoveredPoint && (
            <div
              id={tooltipId}
              className="wpm-chart-tooltip"
              role="tooltip"
              style={{
                left: `${hoveredPoint.px}%`,
                top: `${hoveredPoint.py}%`,
              }}
            >
              <span className="wpm-chart-tooltip-wpm">{hoveredPoint.wpm} wpm</span>
              <span className="wpm-chart-tooltip-sec">
                run {hoveredPoint.index + 1} · {formatRunDate(hoveredPoint.date)}
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
