// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import WpmProgressChart from "./WpmProgressChart";

describe("WpmProgressChart", () => {
  it("shows empty state with fewer than two runs", () => {
    render(
      <WpmProgressChart
        history={[{ finishedAt: "2026-06-09T12:00:00Z", wpm: 78 }]}
      />
    );
    expect(screen.getByText(/at least two tests/i)).toBeTruthy();
  });

  it("renders chart when history has multiple points", () => {
    render(
      <WpmProgressChart
        history={[
          { finishedAt: "2026-06-08T12:00:00Z", wpm: 70 },
          { finishedAt: "2026-06-09T12:00:00Z", wpm: 94 },
        ]}
      />
    );
    expect(screen.getByLabelText(/words per minute across completed tests/i)).toBeTruthy();
    expect(screen.getByText("↑ +24")).toBeTruthy();
  });
});
