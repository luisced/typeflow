export type Mode = "time" | "words" | "quote";

export type CaretStyle = "line" | "underline" | "block" | "outline";

export type KeyboardLayout =
  | "qwerty"
  | "dvorak"
  | "colemak"
  | "workman"
  | "other";

export interface Keyboard {
  id: string;
  name: string;
  layout: KeyboardLayout;
  isActive: boolean;
  createdAt: string;
}

export interface TestConfig {
  mode: Mode;
  /** seconds for time mode, word count for words mode; ignored for quote */
  value: number;
}

export type CharState = "correct" | "incorrect" | "extra" | "untyped";

/** A single keystroke event for session replay. */
export interface KeyEvent {
  /** The key string (e.g. "a", " ", "Backspace"). */
  key: string;
  /** Milliseconds since test start (integer). */
  t: number;
  /** False when the keystroke was a miss (wrong char or premature space). */
  ok: boolean;
}

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
  /** Per-second raw WPM (all typed chars). */
  rawSamples?: number[];
  /** 0-based second indices when a miss occurred (one entry per miss keystroke). */
  errorSeconds?: number[];
  /** Full keystroke log for session replay. */
  keyLog?: KeyEvent[];
  /** Exact word stream shown during the run (for replay). */
  words?: string[];
  keyboardId?: string;
  keyboardName?: string;
  keyboardLayout?: KeyboardLayout;
}
