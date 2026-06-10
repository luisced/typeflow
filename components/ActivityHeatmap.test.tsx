// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ActivityHeatmap from "./ActivityHeatmap";

describe("ActivityHeatmap", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-09T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders month labels and a cell tooltip target", () => {
    render(
      <ActivityHeatmap
        dailyStats={[{ date: "2025-06-01", avgWpm: 104, runCount: 3 }]}
      />
    );
    expect(screen.getByText(/activity/i)).toBeTruthy();
    expect(screen.getByLabelText(/jun 1 — avg 104 wpm/i)).toBeTruthy();
  });

  it("shows empty-state guidance when no stats", () => {
    render(<ActivityHeatmap dailyStats={[]} />);
    expect(screen.getByText(/finish some tests/i)).toBeTruthy();
  });

  it("maps stats onto the current week, not a year-ago label", () => {
    vi.setSystemTime(new Date("2026-06-09T21:00:00-06:00"));
    render(
      <ActivityHeatmap
        dailyStats={[{ date: "2026-06-09", avgWpm: 78, runCount: 17 }]}
      />
    );
    expect(screen.getByLabelText(/jun 9 — avg 78 wpm/i)).toBeTruthy();
  });

  it("marks active squares as interactive", () => {
    vi.setSystemTime(new Date("2026-06-09T21:00:00-06:00"));
    render(
      <ActivityHeatmap
        dailyStats={[{ date: "2026-06-09", avgWpm: 78, runCount: 17 }]}
      />
    );

    const active = document.querySelectorAll("button.hm-cell.has-activity");
    expect(active.length).toBeGreaterThan(0);
    expect(document.querySelector(".activity-aside-hint")?.textContent).toMatch(
      /hover or click a square/i
    );
  });
});
