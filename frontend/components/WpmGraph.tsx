"use client";

import { useId, useRef, useState } from "react";

interface Props {
  samples: number[];
  rawSamples?: number[];
  errorSeconds?: number[];
}

const W = 680;
const H = 268;
const PAD = { l: 36, r: 16, t: 22, b: 26 };

function ErrorX({ cx, cy, count = 1 }: { cx: number; cy: number; count?: number }) {
  const size = Math.min(3 + Math.log2(count) * 0.7, 5);
  const sw = 1.2 + (count > 1 ? 0.2 : 0);
  return (
    <g stroke="var(--error)" strokeWidth={sw} strokeLinecap="round">
      <line x1={cx - size} y1={cy - size} x2={cx + size} y2={cy + size} />
      <line x1={cx + size} y1={cy - size} x2={cx - size} y2={cy + size} />
    </g>
  );
}

export default function WpmGraph({ samples, rawSamples, errorSeconds = [] }: Props) {
  const data = samples.length ? samples : [0];
  const rawData =
    rawSamples && rawSamples.length === data.length ? rawSamples : null;
  const max = Math.max(40, ...data, ...(rawData ?? [])) * 1.1;
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const tooltipId = useId();

  const x = (i: number) =>
    PAD.l + (data.length <= 1 ? 0 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => PAD.t + innerH - (v / max) * innerH;

  const linePath = (values: number[]) =>
    values.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");

  const line = linePath(data);
  const area = `${line} L ${x(data.length - 1)} ${PAD.t + innerH} L ${x(0)} ${
    PAD.t + innerH
  } Z`;

  const avg = data.reduce((a, b) => a + b, 0) / data.length;
  const gridLines = [0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));

  // Aggregate error seconds → one marker per second, count = how many misses
  const errorCountMap = new Map<number, number>();
  for (const sec of errorSeconds) {
    if (sec >= 0 && sec < data.length) {
      errorCountMap.set(sec, (errorCountMap.get(sec) ?? 0) + 1);
    }
  }
  const errorMarkers = Array.from(errorCountMap.entries()).map(([sec, count]) => ({
    sec,
    count,
  }));

  const indexFromClientX = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const plotLeft = (PAD.l / W) * rect.width;
    const plotWidth = (innerW / W) * rect.width;
    const relX = clientX - rect.left - plotLeft;
    if (relX < 0 || relX > plotWidth) return null;
    if (data.length <= 1) return 0;
    const ratio = relX / plotWidth;
    return Math.min(data.length - 1, Math.max(0, Math.round(ratio * (data.length - 1))));
  };

  const handlePointer = (clientX: number) => {
    setHovered(indexFromClientX(clientX));
  };

  const hoveredPoint =
    hovered !== null
      ? {
          index: hovered,
          wpm: data[hovered],
          raw: rawData?.[hovered] ?? null,
          errors: errorCountMap.get(hovered) ?? 0,
          px: (x(hovered) / W) * 100,
          py: (y(data[hovered]) / H) * 100,
        }
      : null;

  return (
    <div
      ref={wrapRef}
      className="wpm-chart-wrap"
      onMouseMove={(e) => handlePointer(e.clientX)}
      onMouseLeave={() => setHovered(null)}
      role="img"
      aria-label="Words per minute over time. Hover to inspect each second."
      aria-describedby={hoveredPoint ? tooltipId : undefined}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full block"
        style={{ aspectRatio: `${W} / ${H}` }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
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

        <path d={area} fill="url(#fill)" />
        {rawData && (
          <path
            d={linePath(rawData)}
            fill="none"
            stroke="var(--cool)"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity="0.75"
          />
        )}
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
            r={hovered === i ? 4 : 1.7}
            fill="var(--accent)"
            opacity={hovered === null || hovered === i ? 1 : 0.45}
          />
        ))}

        {rawData?.map((v, i) => (
          <circle
            key={`raw-${i}`}
            cx={x(i)}
            cy={y(v)}
            r={hovered === i ? 3.5 : 1.4}
            fill="var(--cool)"
            opacity={hovered === null || hovered === i ? 0.85 : 0.35}
          />
        ))}

        {errorMarkers.map(({ sec, count }) => {
          const wpm = data[sec] ?? 0;
          const cy = y(Math.max(wpm, 8));
          return (
            <ErrorX key={`err-${sec}`} cx={x(sec)} cy={cy} count={count} />
          );
        })}

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
          {hoveredPoint.raw != null && hoveredPoint.raw !== hoveredPoint.wpm && (
            <span className="wpm-chart-tooltip-raw">{hoveredPoint.raw} raw</span>
          )}
          {hoveredPoint.errors > 0 && (
            <span className="wpm-chart-tooltip-errors">
              {hoveredPoint.errors} miss{hoveredPoint.errors > 1 ? "es" : ""}
            </span>
          )}
          <span className="wpm-chart-tooltip-sec">
            second {hoveredPoint.index + 1}
          </span>
        </div>
      )}
    </div>
  );
}
