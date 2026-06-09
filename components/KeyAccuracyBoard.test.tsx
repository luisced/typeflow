// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import KeyAccuracyBoard from "./KeyAccuracyBoard";

afterEach(() => {
  cleanup();
});

describe("KeyAccuracyBoard", () => {
  it("shows default prompt then trend after key click", () => {
    render(
      <KeyAccuracyBoard
        keyAccuracy={{ t: 82, h: 96 }}
        keyTrends={{ t: [74, 78, 82] }}
      />
    );

    expect(screen.getByText(/click a key/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /t key/i }));
    expect(screen.getByText(/82%/)).toBeTruthy();
    expect(screen.getByText(/best/i)).toBeTruthy();
  });

  it("shows not-enough-data message for keys with <2 trend points", () => {
    render(
      <KeyAccuracyBoard
        keyAccuracy={{ t: 82 }}
        keyTrends={{ t: [82] }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /t key/i }));
    expect(screen.getByText(/not enough data yet/i)).toBeTruthy();
  });
});
