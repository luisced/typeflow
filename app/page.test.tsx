// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attemptSilentRefresh } from "@/lib/api";
import { setSession } from "@/lib/auth";
import Home from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    attemptSilentRefresh: vi.fn().mockResolvedValue(false),
    getAccessToken: vi.fn().mockReturnValue(null),
  };
});

vi.mock("@/lib/sync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/sync")>();
  return {
    ...actual,
    syncNow: vi.fn().mockResolvedValue(undefined),
    subscribeSyncMerge: vi.fn(() => () => {}),
  };
});

function dispatchKey(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key }));
  });
}

describe("Home keyboard flow", () => {
  beforeEach(() => {
    setSession({
      id: "u1",
      email: "test@example.com",
      username: "testuser",
      displayName: "Test User",
      createdAt: "2026-01-01T00:00:00Z",
    });
    vi.mocked(attemptSilentRefresh).mockResolvedValue(false);
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    setSession(null);
    vi.clearAllMocks();
  });

  it("shows typing content on initial render", () => {
    const { container } = render(<Home />);

    expect(container.querySelector(".type-word")).not.toBeNull();
  });

  it("resumes from pause and consumes the first typed key", async () => {
    const { container } = render(<Home />);

    await waitFor(() => {
      expect(container.querySelector(".type-word")).not.toBeNull();
    });

    const firstWord = container.querySelector(".type-word");
    if (!(firstWord instanceof HTMLElement)) {
      throw new Error("expected first typing word to render");
    }

    const cells = Array.from(firstWord.querySelectorAll(".type-char"));
    const visibleChars = cells
      .map((cell) => cell.textContent ?? "")
      .filter((char) => char.trim().length > 0);

    const firstChar = visibleChars[0];
    expect(firstChar).toBeTruthy();

    dispatchKey(firstChar);

    act(() => {
      window.dispatchEvent(new Event("blur"));
    });

    if (visibleChars.length >= 2) {
      dispatchKey(visibleChars[1]);

      await waitFor(() => {
        const nextCells = Array.from(
          container.querySelectorAll(".type-word")[0]?.querySelectorAll(
            ".type-char"
          ) ?? []
        );
        expect(nextCells[0]?.getAttribute("data-s")).toBe("correct");
        expect(nextCells[1]?.getAttribute("data-s")).toBe("correct");
      });
      return;
    }

    dispatchKey(" ");

    await waitFor(() => {
      expect(container.textContent).toContain("1/30");
    });
  });

  it("underlines typo words only after the user has passed them", async () => {
    const { container } = render(<Home />);

    await waitFor(() => {
      expect(container.querySelector(".type-word")).not.toBeNull();
    });

    const firstWord = container.querySelector(".type-word");
    if (!(firstWord instanceof HTMLElement)) {
      throw new Error("expected first typing word to render");
    }

    const visibleChars = Array.from(firstWord.querySelectorAll(".type-char"))
      .map((cell) => cell.textContent ?? "")
      .filter((char) => char.trim().length > 0);

    if (visibleChars.length === 0) {
      throw new Error("expected visible starting characters");
    }

    const firstChar = visibleChars[0];
    const wrongKey = firstChar.toLowerCase() === "x" ? "z" : "x";
    dispatchKey(wrongKey);

    expect(firstWord.getAttribute("data-has-typo")).toBeNull();

    for (const key of visibleChars.slice(1)) {
      dispatchKey(key);
    }
    dispatchKey(" ");

    await waitFor(() => {
      expect(firstWord.getAttribute("data-has-typo")).toBe("true");
    });
  });

  it("does not render focus-lost UI after blur", async () => {
    const { container } = render(<Home />);

    await waitFor(() => {
      expect(container.querySelector(".type-word")).not.toBeNull();
    });

    const firstWord = container.querySelector(".type-word");
    if (!(firstWord instanceof HTMLElement)) {
      throw new Error("expected first typing word to render");
    }

    const firstChar = Array.from(firstWord.querySelectorAll(".type-char"))
      .map((cell) => cell.textContent ?? "")
      .find((char) => char.trim().length > 0);

    if (!firstChar) {
      throw new Error("expected a visible starting character");
    }

    dispatchKey(firstChar);

    act(() => {
      window.dispatchEvent(new Event("blur"));
    });

    expect(container.querySelector(".pause-screen")).toBeNull();
    expect(container.querySelector(".pause-card")).toBeNull();
    expect(container.querySelector(".pause-message")).toBeNull();
    expect(container.querySelector(".focus-overlay")).toBeNull();
  });
});
