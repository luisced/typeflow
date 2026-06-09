// @vitest-environment jsdom

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProfilePage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  getUser: () => ({
    id: "1",
    email: "a@b.com",
    username: "luisced",
    displayName: "Luis Cedillo",
    createdAt: "2024-01-01T00:00:00Z",
  }),
}));

vi.mock("@/lib/api", () => ({
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
    keyAccuracy: {},
    keyTrends: {},
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
