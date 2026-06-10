// @vitest-environment jsdom

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProfilePage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), back: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    attemptSilentRefresh: vi.fn().mockResolvedValue(true),
    fetchProfileStats: vi.fn().mockResolvedValue({
      summary: {
        bestWpm: 127,
        avgWpm: 98,
        avgAccuracy: 96,
        totalRuns: 231,
        totalTimeSec: 48200,
      },
      dailyStats: [],
      wpmHistory: [
        { finishedAt: "2026-06-08T12:00:00Z", wpm: 70 },
        { finishedAt: "2026-06-09T12:00:00Z", wpm: 94 },
      ],
      keyAccuracy: {},
      keyTrends: {},
    }),
    fetchRunSummaries: vi.fn().mockResolvedValue([]),
    getAccessToken: vi.fn(() => "token"),
  };
});

vi.mock("@/lib/network", () => ({
  isOnline: vi.fn(() => true),
}));

vi.mock("@/lib/auth", () => ({
  subscribe: vi.fn(() => () => {}),
  getUser: () => ({
    id: "1",
    email: "a@b.com",
    username: "luisced",
    displayName: "Luis Cedillo",
    createdAt: "2024-01-01T00:00:00Z",
  }),
}));

vi.mock("@/lib/useKeyboards", () => ({
  useKeyboards: () => ({
    keyboards: [{ id: "kb1", name: "K2", layout: "qwerty", isActive: true, createdAt: "" }],
    activeKeyboard: { id: "kb1", name: "K2", layout: "qwerty", isActive: true, createdAt: "" },
    loading: false,
    refresh: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    setActive: vi.fn(),
  }),
}));

describe("ProfilePage", () => {
  it("renders user name and summary stats", async () => {
    render(<ProfilePage />);
    await waitFor(() => {
      expect(screen.getByText("Luis Cedillo")).toBeTruthy();
      expect(screen.getByText("127")).toBeTruthy();
    });
  });
});
