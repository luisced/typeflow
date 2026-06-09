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
});
