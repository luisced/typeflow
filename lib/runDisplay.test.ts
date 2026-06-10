import { describe, expect, it } from "vitest";
import { filterSummaries } from "./runDisplay";
import type { RunSummary } from "./api";

function summary(id: string, keyboardId?: string, keyboardLayout?: string): RunSummary {
  return {
    id,
    mode: "time",
    value: 30,
    wpm: 80,
    accuracy: 95,
    consistency: 90,
    durationSec: 30,
    date: 1,
    keyboardId,
    keyboardLayout: keyboardLayout as RunSummary["keyboardLayout"],
  };
}

describe("filterSummaries", () => {
  const runs = [
    summary("a", "kb1", "qwerty"),
    summary("b", "kb2", "dvorak"),
    summary("c"),
  ];

  it("returns all runs when no filters", () => {
    expect(filterSummaries(runs)).toHaveLength(3);
  });

  it("filters by keyboardId", () => {
    expect(filterSummaries(runs, { keyboardId: "kb1" }).map((r) => r.id)).toEqual([
      "a",
    ]);
  });

  it("filters by layout", () => {
    expect(filterSummaries(runs, { layout: "dvorak" }).map((r) => r.id)).toEqual([
      "b",
    ]);
  });
});
