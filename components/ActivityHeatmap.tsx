"use client";

import { useState } from "react";
import ChartHelp from "@/components/ChartHelp";
import type { DailyStat } from "@/lib/api";

interface Props {
  dailyStats: DailyStat[];
  loading?: boolean;
}

const WEEKS = 52;
const DAYS = 7;

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function buildWeekGrid(end: Date): Date[][] {
  const today = startOfDay(end);
  const currentWeekSunday = new Date(today);
  currentWeekSunday.setDate(today.getDate() - today.getDay());

  const gridStart = new Date(currentWeekSunday);
  gridStart.setDate(currentWeekSunday.getDate() - (WEEKS - 1) * DAYS);

  const weeks: Date[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const week: Date[] = [];
    for (let d = 0; d < DAYS; d++) {
      const cell = new Date(gridStart);
      cell.setDate(gridStart.getDate() + w * DAYS + d);
      week.push(cell);
    }
    weeks.push(week);
  }
  return weeks;
}

function wpmLevel(
  avgWpm: number | undefined,
  min: number,
  max: number
): 0 | 1 | 2 | 3 | 4 {
  if (avgWpm === undefined) return 0;
  if (min === max) return 2;
  const t = (avgWpm - min) / (max - min);
  if (t <= 0.25) return 1;
  if (t <= 0.5) return 2;
  if (t <= 0.75) return 3;
  return 4;
}

function formatCellLabel(
  date: Date,
  stat: DailyStat | undefined,
  inRange: boolean
): string {
  const dateLabel = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  if (!inRange || !stat) {
    return `${dateLabel} — no activity`;
  }
  const runs = stat.runCount === 1 ? "1 run" : `${stat.runCount} runs`;
  return `${dateLabel} — avg ${stat.avgWpm} wpm (${runs})`;
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short" });
}

function formatAsideDate(key: string): string {
  return startOfDay(new Date(`${key}T12:00:00`)).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function ActivityAside({
  focusKey,
  focusStat,
  populated,
}: {
  focusKey: string | null;
  focusStat: DailyStat | undefined;
  populated: DailyStat[];
}) {
  if (focusStat && focusKey) {
    const runs =
      focusStat.runCount === 1 ? "1 run" : `${focusStat.runCount} runs`;
    return (
      <div className="activity-heatmap-aside-content">
        <p className="activity-aside-date">{formatAsideDate(focusKey)}</p>
        <p className="activity-aside-wpm">{focusStat.avgWpm}</p>
        <p className="activity-aside-wpm-label">avg wpm</p>
        <p className="activity-aside-runs">{runs}</p>
      </div>
    );
  }

  const activeDays = populated.length;
  const totalRuns = populated.reduce((sum, day) => sum + day.runCount, 0);

  return (
    <div className="activity-heatmap-aside-content is-idle">
      <p className="activity-aside-hint">
        Hover or click a square to see that day&apos;s stats
      </p>
      {activeDays > 0 && (
        <dl className="activity-aside-summary">
          <div>
            <dt>Active days</dt>
            <dd>{activeDays}</dd>
          </div>
          <div>
            <dt>Total runs</dt>
            <dd>{totalRuns}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}

export default function ActivityHeatmap({ dailyStats, loading }: Props) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const today = startOfDay(new Date());
  const statMap = new Map(dailyStats.map((s) => [s.date, s]));

  const populated = dailyStats.filter((s) => s.runCount > 0);
  const wpms = populated.map((s) => s.avgWpm);
  const minWpm = wpms.length ? Math.min(...wpms) : 0;
  const maxWpm = wpms.length ? Math.max(...wpms) : 0;

  const weeks = buildWeekGrid(today);
  const rangeStart = new Date(today);
  rangeStart.setDate(today.getDate() - (WEEKS * DAYS - 1));

  const monthMarkers = weeks.map((week, wi) => {
    const firstInRange = week.find((d) => d >= rangeStart && d <= today);
    if (!firstInRange) return null;
    const prevWeek = wi > 0 ? weeks[wi - 1] : null;
    const prevInRange = prevWeek?.find((d) => d >= rangeStart && d <= today);
    if (!prevInRange || prevInRange.getMonth() !== firstInRange.getMonth()) {
      return monthLabel(firstInRange);
    }
    return null;
  });

  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];
  const showDayLabel = (di: number) => di === 1 || di === 3 || di === 5;

  const isEmpty = !loading && dailyStats.length === 0;
  const focusKey = hoveredKey ?? selectedKey;
  const focusStat = focusKey ? statMap.get(focusKey) : undefined;

  const grid = (
    <div className="activity-heatmap-grid-wrap">
      <div className="hm-day-labels" aria-hidden="true">
        {dayLabels.map((label, di) => (
          <span key={di} className="hm-day-label">
            {showDayLabel(di) ? label : ""}
          </span>
        ))}
      </div>

      <div className="activity-heatmap-grid">
        <div className="hm-month-row" aria-hidden="true">
          {monthMarkers.map((label, wi) => (
            <span key={wi} className="hm-month-label">
              {label ?? ""}
            </span>
          ))}
        </div>

        <div className="hm-weeks">
          {weeks.map((week, wi) => (
            <div key={wi} className="hm-week-col">
              {week.map((date, di) => {
                const key = toDateKey(date);
                const inRange = date >= rangeStart && date <= today;
                const stat = inRange ? statMap.get(key) : undefined;
                const level = inRange
                  ? wpmLevel(stat?.avgWpm, minWpm, maxWpm)
                  : 0;
                const label = formatCellLabel(date, stat, inRange);
                const hasActivity = inRange && !!stat;
                const isActive = hasActivity && focusKey === key;

                return (
                  <button
                    key={di}
                    type="button"
                    className={`hm-cell l${level}${hasActivity ? " has-activity" : ""}${isActive ? " is-active" : ""}`}
                    aria-label={label}
                    aria-pressed={isActive}
                    tabIndex={hasActivity ? 0 : -1}
                    onMouseEnter={() => {
                      if (hasActivity) setHoveredKey(key);
                    }}
                    onMouseLeave={() => setHoveredKey(null)}
                    onFocus={() => {
                      if (hasActivity) setHoveredKey(key);
                    }}
                    onBlur={() => setHoveredKey(null)}
                    onClick={() => {
                      if (!hasActivity) return;
                      setSelectedKey((current) =>
                        current === key ? null : key
                      );
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const title = (
    <div className="activity-heatmap-header">
      <h3 className="activity-heatmap-title">Activity</h3>
      <ChartHelp label="What is the activity heatmap?" size="sm">
        <>
          One square per day for the last year. Color intensity shows your{" "}
          <strong>average WPM</strong> that day — brighter orange means a faster
          day. Hover or click a square for details.
        </>
      </ChartHelp>
    </div>
  );

  if (loading) {
    return (
      <section className="activity-heatmap" aria-busy="true" aria-label="Activity">
        {title}
        <div className="activity-heatmap-body">
          <div className="activity-heatmap-main">
            <div className="activity-heatmap-scroll" aria-hidden="true">
              <div className="activity-heatmap-skeleton hm-weeks">
                {Array.from({ length: WEEKS }).map((_, wi) => (
                  <div key={wi} className="hm-week-col">
                    {Array.from({ length: DAYS }).map((_, di) => (
                      <div key={di} className="hm-cell hm-skeleton" />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <aside className="activity-heatmap-aside" aria-hidden="true">
            <div className="activity-heatmap-aside-content is-idle">
              <p className="activity-aside-hint">Loading activity…</p>
            </div>
          </aside>
        </div>
      </section>
    );
  }

  return (
    <section className="activity-heatmap" aria-label="Activity">
      {title}

      <div className="activity-heatmap-body">
        <div className="activity-heatmap-main">
          <div className="activity-heatmap-scroll">{grid}</div>

          {isEmpty && (
            <p className="activity-heatmap-empty">
              finish some tests to fill this in
            </p>
          )}

          <div className="activity-heatmap-footer">
            <div className="hm-legend" aria-hidden="true">
              <span>less</span>
              <span className="hm-legend-cells">
                <span className="hm-cell l0" />
                <span className="hm-cell l1" />
                <span className="hm-cell l2" />
                <span className="hm-cell l3" />
                <span className="hm-cell l4" />
              </span>
              <span>more (high wpm)</span>
            </div>
          </div>
        </div>

        <aside className="activity-heatmap-aside" aria-live="polite">
          <ActivityAside
            focusKey={focusKey}
            focusStat={focusStat}
            populated={populated}
          />
        </aside>
      </div>
    </section>
  );
}
