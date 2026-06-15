import type { Mode } from "./types";

export interface ContentFlags {
  punctuation: boolean;
  numbers: boolean;
  capitals: boolean;
}

export const DEFAULT_CONTENT_FLAGS: ContentFlags = {
  punctuation: false,
  numbers: false,
  capitals: false,
};

/** Coerce partial or missing flags into a full ContentFlags object. */
export function normalizeContentFlags(
  flags?: Partial<ContentFlags> | null
): ContentFlags {
  if (!flags) return { ...DEFAULT_CONTENT_FLAGS };
  return {
    punctuation: !!flags.punctuation,
    numbers: !!flags.numbers,
    capitals: !!flags.capitals,
  };
}

/** Stable bucket key from enabled flags: "base" or sorted codes e.g. "c,n,p". */
export function flagsKeyFromFlags(flags: ContentFlags): string {
  const parts: string[] = [];
  if (flags.capitals) parts.push("c");
  if (flags.numbers) parts.push("n");
  if (flags.punctuation) parts.push("p");
  return parts.length === 0 ? "base" : parts.join(",");
}

/** Quote mode ignores flags; all other modes bucket by enabled flags. */
export function flagsKeyForMode(mode: Mode | string, flags?: ContentFlags | null): string {
  if (mode === "quote") return "base";
  return flagsKeyFromFlags(normalizeContentFlags(flags));
}

const FLAG_LABELS: Record<string, string> = {
  c: "Aa",
  n: "123",
  p: "?!",
};

/** Human-readable label for a flagsKey (e.g. "c,n" → "Aa 123"). */
export function labelForFlagsKey(key: string | undefined | null): string {
  if (!key || key === "base") return "base";
  return key
    .split(",")
    .map((part) => FLAG_LABELS[part] ?? part)
    .join(" ");
}

const FLAGS_STORAGE_KEY = "typeflow.flags.v1";

export function loadContentFlags(): ContentFlags {
  if (typeof window === "undefined") return { ...DEFAULT_CONTENT_FLAGS };
  try {
    const raw = window.localStorage.getItem(FLAGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONTENT_FLAGS };
    return normalizeContentFlags(JSON.parse(raw) as Partial<ContentFlags>);
  } catch {
    return { ...DEFAULT_CONTENT_FLAGS };
  }
}

export function saveContentFlags(flags: ContentFlags): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        FLAGS_STORAGE_KEY,
        JSON.stringify(normalizeContentFlags(flags))
      );
    }
  } catch {
    /* quota / private mode */
  }
}
