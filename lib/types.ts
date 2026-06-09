export type Mode = "time" | "words" | "quote";

export type CaretStyle = "line" | "underline" | "block" | "outline";

export interface TestConfig {
  mode: Mode;
  /** seconds for time mode, word count for words mode; ignored for quote */
  value: number;
}

export type CharState = "correct" | "incorrect" | "extra" | "untyped";

/** A completed run, persisted to localStorage. */
export interface RunRecord {
  id: string;
  mode: Mode;
  value: number;
  wpm: number;
  raw: number;
  accuracy: number;
  consistency: number;
  durationSec: number;
  date: number;
  errorMap: Record<string, number>;
  keyMap: Record<string, number>;
  samples: number[];
}
