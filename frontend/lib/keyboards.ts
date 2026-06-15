import type { Keyboard, KeyboardLayout } from "./types";

type Listener = () => void;

let keyboards: Keyboard[] = [];
const listeners = new Set<Listener>();

export function getKeyboards(): Keyboard[] {
  return keyboards;
}

export function getActiveKeyboard(): Keyboard | null {
  return keyboards.find((k) => k.isActive) ?? null;
}

export function getActiveKeyboardId(): string | undefined {
  return getActiveKeyboard()?.id;
}

export function setKeyboards(next: Keyboard[]): void {
  keyboards = next;
  listeners.forEach((cb) => cb());
}

export function clearKeyboards(): void {
  keyboards = [];
  listeners.forEach((cb) => cb());
}

export function subscribeKeyboards(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export const KEYBOARD_LAYOUTS = [
  "qwerty",
  "dvorak",
  "colemak",
  "workman",
  "other",
] as const;

export function layoutLabel(layout: string): string {
  if (layout === "qwerty") return "QWERTY";
  if (layout === "other") return "Other";
  return layout.charAt(0).toUpperCase() + layout.slice(1);
}

/** Letter rows for key-accuracy visualization (bottom row is rendered separately as space). */
const LAYOUT_ROWS: Record<KeyboardLayout, string[][]> = {
  qwerty: ["qwertyuiop", "asdfghjkl", "zxcvbnm"].map((row) => row.split("")),
  dvorak: [
    ["`", ",", ".", "p", "y", "f", "g", "c", "r", "l"],
    "aoeuidhtns".split(""),
    [";", "q", "j", "k", "x", "b", "m", "w", "v", "z"],
  ],
  colemak: ["qwfpgjluy;", "arstdhneio", "zxcvbkm"].map((row) => row.split("")),
  workman: ["qdrwbjfup;", "ashtgneoi", "zxmcvkl"].map((row) => row.split("")),
  other: ["qwertyuiop", "asdfghjkl", "zxcvbnm"].map((row) => row.split("")),
};

export function layoutRows(layout: KeyboardLayout): string[][] {
  return LAYOUT_ROWS[layout];
}

export function resolveKeyAccuracyLayout(
  filters: { keyboardId?: string; layout?: KeyboardLayout },
  keyboards: Keyboard[]
): KeyboardLayout {
  if (filters.layout) return filters.layout;
  if (filters.keyboardId) {
    const kb = keyboards.find((k) => k.id === filters.keyboardId);
    if (kb) return kb.layout;
  }
  return getActiveKeyboard()?.layout ?? "qwerty";
}
