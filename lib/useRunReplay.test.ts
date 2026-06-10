// @vitest-environment jsdom

import { act } from "react";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRunReplay } from "./useRunReplay";
import type { RunRecord } from "./types";

const record: RunRecord = {
  id: "replay-test",
  mode: "words",
  value: 2,
  wpm: 40,
  raw: 40,
  accuracy: 100,
  consistency: 100,
  durationSec: 2,
  date: 1,
  errorMap: {},
  keyMap: {},
  samples: [40],
  words: ["hi"],
  keyLog: [
    { key: "h", t: 500, ok: true },
    { key: "i", t: 1000, ok: true },
  ],
};

describe("useRunReplay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("auto-plays keys at their scheduled timestamps", () => {
    const { result } = renderHook(() => useRunReplay(record));
    expect(result.current.playing).toBe(true);
    expect(result.current.engine.typed[0]).toBe("");

    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(result.current.engine.typed[0]).toBe("");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.engine.typed[0]).toBe("h");

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.engine.typed[0]).toBe("hi");
    expect(result.current.atEnd).toBe(true);
    expect(result.current.playing).toBe(false);
  });

  it("restart resets to the beginning paused", () => {
    const { result } = renderHook(() => useRunReplay(record));

    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(result.current.atEnd).toBe(true);

    act(() => {
      result.current.restart();
    });

    expect(result.current.playing).toBe(false);
    expect(result.current.elapsedMs).toBe(0);
    expect(result.current.engine.typed[0]).toBe("");
  });
});
