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

    expect(
      document.querySelector(".key-trend-empty")?.textContent
    ).toMatch(/click a key/i);
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

  it("renders dvorak key positions", () => {
    render(
      <KeyAccuracyBoard
        layout="dvorak"
        keyAccuracy={{ p: 90 }}
        keyTrends={{ p: [88, 90] }}
      />
    );

    const keyboard = document.querySelector(".key-accuracy-keyboard");
    expect(keyboard?.getAttribute("data-layout")).toBe("dvorak");
    expect(screen.getByText("Dvorak")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /p key/i }));
    expect(screen.getByText(/90%/)).toBeTruthy();
  });
});
