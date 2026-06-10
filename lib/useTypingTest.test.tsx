// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TestConfig } from "./types";
import { useTypingTest } from "./useTypingTest";

function buildCorrectKeyStream(words: string[], keyCount: number): string[] {
  const keys: string[] = [];

  for (const word of words) {
    for (const char of word) {
      keys.push(char);
      if (keys.length === keyCount) return keys;
    }
    keys.push(" ");
    if (keys.length === keyCount) return keys;
  }

  return keys;
}

describe("useTypingTest live WPM", () => {
  let now = 0;
  let rafCallback: FrameRequestCallback | null = null;

  beforeEach(() => {
    now = 0;
    rafCallback = null;

    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafCallback = cb;
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {
      rafCallback = null;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("drops live WPM to zero after five seconds of inactivity", async () => {
    const latest: { current: ReturnType<typeof useTypingTest> | null } = {
      current: null,
    };

    function getLatest() {
      if (!latest.current) {
        throw new Error("expected hook state to be captured");
      }
      return latest.current;
    }

    function Harness({ config }: { config: TestConfig }) {
      latest.current = useTypingTest(config);
      return null;
    }

    render(<Harness config={{ mode: "time", value: 30 }} />);

    await waitFor(() => {
      expect(getLatest().engine.words.length).toBeGreaterThan(0);
    });

    const keys = buildCorrectKeyStream(getLatest().engine.words, 10);
    expect(keys).toHaveLength(10);

    act(() => {
      for (const key of keys) {
        getLatest().onKey(key);
      }
    });

    await waitFor(() => {
      expect(rafCallback).not.toBeNull();
    });

    now = 10_000;
    act(() => {
      rafCallback?.(now);
    });

    await waitFor(() => {
      expect(getLatest().elapsed).toBe(10);
    });

    expect(getLatest().liveWpm).toBe(0);
  });
});
