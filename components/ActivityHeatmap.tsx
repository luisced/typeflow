"use client";

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
  const totalDays = WEEKS * DAYS;
  const rangeStart = new Date(today);
  rangeStart.setDate(today.getDate() - (totalDays - 1));

  const gridStart = new Date(rangeStart);
  gridStart.setDate(rangeStart.getDate() - rangeStart.getDay());

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

export default function ActivityHeatmap({ dailyStats, loading }: Props) {
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

  if (loading) {
    return (
      <section className="activity-heatmap" aria-busy="true" aria-label="Activity">
        <h3 className="activity-heatmap-title">Activity</h3>
        <div className="activity-heatmap-skeleton" aria-hidden="true">
          {Array.from({ length: WEEKS }).map((_, wi) => (
            <div key={wi} className="hm-week-col">
              {Array.from({ length: DAYS }).map((_, di) => (
                <div key={di} className="hm-cell hm-skeleton" />
              ))}
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="activity-heatmap" aria-label="Activity">
      <h3 className="activity-heatmap-title">Activity</h3>

      <div className="activity-heatmap-scroll">
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

                    return (
                      <button
                        key={di}
                        type="button"
                        className={`hm-cell l${level}`}
                        aria-label={label}
                        title={label}
                        tabIndex={-1}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {isEmpty && (
        <p className="activity-heatmap-empty">finish some tests to fill this in</p>
      )}

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
    </section>
  );
}
