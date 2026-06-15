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

describe("useTypingTest timing behavior", () => {
  let now = 0;
  let rafCallback: FrameRequestCallback | null = null;

  const latest: { current: ReturnType<typeof useTypingTest> | null } = {
    current: null,
  };

  function getLatest() {
    if (!latest.current) throw new Error("expected hook state");
    return latest.current;
  }

  function Harness({ config }: { config: TestConfig }) {
    latest.current = useTypingTest(config);
    return null;
  }

  beforeEach(() => {
    now = 0;
    rafCallback = null;
    latest.current = null;
    window.localStorage.clear();

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
    window.localStorage.clear();
  });

  it("replaces the deterministic SSR seed with random words after mount", async () => {
    const { initialSampleWords } = await import("./content");
    render(<Harness config={{ mode: "time", value: 30 }} />);

    await waitFor(() => {
      expect(getLatest().engine.words.length).toBeGreaterThan(0);
    });

    // the deterministic seed is the word list in original order; a fresh
    // shuffle matching it is astronomically unlikely
    const seeded = initialSampleWords(60).join(" ");
    await waitFor(() => {
      expect(getLatest().engine.words.join(" ")).not.toBe(seeded);
    });
  });

  it("records instantaneous per-second WPM samples, not cumulative averages", async () => {
    render(<Harness config={{ mode: "time", value: 3 }} />);

    await waitFor(() => {
      expect(getLatest().engine.words.length).toBeGreaterThan(0);
    });

    // type 10 correct chars at t=0, then go idle until the 3s run ends
    const keys = buildCorrectKeyStream(getLatest().engine.words, 10);
    act(() => {
      for (const key of keys) getLatest().onKey(key);
    });

    await waitFor(() => expect(rafCallback).not.toBeNull());

    now = 3000;
    act(() => {
      rafCallback?.(now);
    });

    await waitFor(() => expect(getLatest().result).not.toBeNull());

    const samples = getLatest().result!.record.samples;
    expect(samples).toHaveLength(3);
    // everything was typed in second 1; seconds 2-3 were idle
    expect(samples[0]).toBeGreaterThan(0);
    expect(samples[1]).toBe(0);
    expect(samples[2]).toBe(0);

    const rawSamples = getLatest().result!.record.rawSamples;
    expect(rawSamples).toHaveLength(3);
    expect(rawSamples![0]).toBeGreaterThan(0);
  });

  it("records error seconds and raw samples when mistakes are made", async () => {
    render(<Harness config={{ mode: "time", value: 3 }} />);

    await waitFor(() => {
      expect(getLatest().engine.words.length).toBeGreaterThan(0);
    });

    const word = getLatest().engine.words[0] ?? "test";
    const keys = [
      word[0],
      "x",
      word[1] ?? "a",
      word.slice(2),
      " ",
    ]
      .flatMap((k) => (typeof k === "string" ? k.split("") : []))
      .filter(Boolean);

    act(() => {
      for (const key of keys) getLatest().onKey(key);
    });

    await waitFor(() => expect(rafCallback).not.toBeNull());
    now = 3000;
    act(() => {
      rafCallback?.(now);
    });

    await waitFor(() => expect(getLatest().result).not.toBeNull());

    const record = getLatest().result!.record;
    expect(record.errorSeconds?.length).toBeGreaterThan(0);
    expect(record.rawSamples?.length).toBe(3);
    expect(record.rawSamples![0]).toBeGreaterThanOrEqual(record.samples[0] ?? 0);
    expect(record.words?.length).toBeGreaterThan(0);
    expect(record.keyLog?.length).toBeGreaterThan(0);
  });

  it("saves the full word stream for replay", async () => {
    render(<Harness config={{ mode: "time", value: 3 }} />);

    await waitFor(() => {
      expect(getLatest().engine.words.length).toBeGreaterThan(0);
    });

    const engineWords = getLatest().engine.words;
    const keys = buildCorrectKeyStream(engineWords, 10);
    act(() => {
      for (const key of keys) getLatest().onKey(key);
    });

    await waitFor(() => expect(rafCallback).not.toBeNull());
    now = 3000;
    act(() => {
      rafCallback?.(now);
    });

    await waitFor(() => expect(getLatest().result).not.toBeNull());

    expect(getLatest().result!.record.words).toEqual(engineWords);
  });

  it("records one replay event per accepted key under StrictMode", async () => {
    render(
      <React.StrictMode>
        <Harness config={{ mode: "words", value: 1 }} />
      </React.StrictMode>
    );

    await waitFor(() => {
      expect(getLatest().engine.words.length).toBeGreaterThan(0);
    });

    const [word] = getLatest().engine.words;
    const keys = word.split("");

    act(() => {
      for (const key of keys) {
        getLatest().onKey(key);
      }
    });

    await waitFor(() => expect(getLatest().result).not.toBeNull());

    expect(getLatest().result!.record.keyLog).toHaveLength(keys.length);
  });

  it("keeps the clock running while paused (no free rest time)", async () => {
    render(<Harness config={{ mode: "time", value: 30 }} />);

    await waitFor(() => {
      expect(getLatest().engine.words.length).toBeGreaterThan(0);
    });

    const keys = buildCorrectKeyStream(getLatest().engine.words, 3);
    act(() => {
      for (const key of keys) getLatest().onKey(key);
    });
    expect(getLatest().phase).toBe("running");

    act(() => {
      getLatest().pause();
    });
    expect(getLatest().phase).toBe("paused");

    // 5 wall-clock seconds pass while paused — the timer must still tick
    await waitFor(() => expect(rafCallback).not.toBeNull());
    now = 5000;
    act(() => {
      rafCallback?.(now);
    });
    await waitFor(() => expect(getLatest().elapsed).toBe(5));

    // resuming must not shift the start time back
    act(() => {
      getLatest().resume();
    });
    expect(getLatest().phase).toBe("running");

    await waitFor(() => expect(rafCallback).not.toBeNull());
    now = 6000;
    act(() => {
      rafCallback?.(now);
    });
    await waitFor(() => expect(getLatest().elapsed).toBe(6));
  });

  it("ends a time-mode run at expiry even while paused", async () => {
    render(<Harness config={{ mode: "time", value: 3 }} />);

    await waitFor(() => {
      expect(getLatest().engine.words.length).toBeGreaterThan(0);
    });

    const keys = buildCorrectKeyStream(getLatest().engine.words, 3);
    act(() => {
      for (const key of keys) getLatest().onKey(key);
    });
    act(() => {
      getLatest().pause();
    });

    await waitFor(() => expect(rafCallback).not.toBeNull());
    now = 4000;
    act(() => {
      rafCallback?.(now);
    });

    await waitFor(() => expect(getLatest().phase).toBe("finished"));
    expect(getLatest().result?.record.durationSec).toBe(3);
  });
});
