// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RunHistoryList from "./RunHistoryList";

vi.mock("@/lib/api", () => ({
  fetchRunSummaries: vi.fn().mockResolvedValue([
    {
      id: "r1",
      mode: "time",
      value: 30,
      wpm: 94,
      accuracy: 90,
      consistency: 85,
      durationSec: 30,
      date: 1_749_500_000_000,
      keyboardName: "Keychron",
      keyboardLayout: "qwerty",
    },
  ]),
  getAccessToken: vi.fn(() => "token"),
}));

vi.mock("@/lib/useKeyboards", () => ({
  useKeyboards: () => ({
    keyboards: [{ id: "kb1", name: "Keychron", layout: "qwerty", isActive: true, createdAt: "" }],
    activeKeyboard: { id: "kb1", name: "Keychron", layout: "qwerty", isActive: true, createdAt: "" },
    loading: false,
    refresh: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    setActive: vi.fn(),
  }),
}));

vi.mock("@/lib/network", () => ({
  isOnline: vi.fn(() => true),
}));

afterEach(() => {
  vi.clearAllMocks();
});

beforeEach(async () => {
  const { fetchRunSummaries } = await import("@/lib/api");
  vi.mocked(fetchRunSummaries).mockResolvedValue([
    {
      id: "r1",
      mode: "time",
      value: 30,
      wpm: 94,
      accuracy: 90,
      consistency: 85,
      durationSec: 30,
      date: 1_749_500_000_000,
      keyboardName: "Keychron",
      keyboardLayout: "qwerty",
    },
  ]);
});

describe("RunHistoryList", () => {
  it("renders run rows on profile variant", async () => {
    render(
      <RunHistoryList variant="page" onViewRun={vi.fn()} active />
    );
    await waitFor(() => {
      expect(screen.getByText("94")).toBeTruthy();
      expect(screen.getByText(/run history/i)).toBeTruthy();
    });
  });

  it("shows empty state when no runs", async () => {
    const { fetchRunSummaries } = await import("@/lib/api");
    vi.mocked(fetchRunSummaries).mockResolvedValueOnce([]);

    render(
      <RunHistoryList variant="page" onViewRun={vi.fn()} active />
    );
    await waitFor(() => {
      expect(screen.getByText(/no runs yet/i)).toBeTruthy();
    });
  });

  it("passes filters to fetchRunSummaries", async () => {
    const { fetchRunSummaries } = await import("@/lib/api");
    vi.mocked(fetchRunSummaries).mockResolvedValue([]);

    render(
      <RunHistoryList
        variant="page"
        onViewRun={vi.fn()}
        active
        filters={{ keyboardId: "kb1", layout: "qwerty" }}
      />
    );

    await waitFor(() => {
      expect(fetchRunSummaries).toHaveBeenCalledWith({
        keyboardId: "kb1",
        layout: "qwerty",
      });
    });
  });

  it("shows keyboard info in run row", async () => {
    render(
      <RunHistoryList variant="page" onViewRun={vi.fn()} active />
    );
    await waitFor(() => {
      expect(screen.getByText(/Keychron/)).toBeTruthy();
      expect(screen.getByText(/QWERTY/)).toBeTruthy();
    });
  });
});
