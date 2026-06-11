import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONTENT_FLAGS,
  flagsKeyForMode,
  flagsKeyFromFlags,
  labelForFlagsKey,
  normalizeContentFlags,
} from "./contentFlags";

describe("normalizeContentFlags", () => {
  it("returns defaults for missing input", () => {
    expect(normalizeContentFlags()).toEqual(DEFAULT_CONTENT_FLAGS);
    expect(normalizeContentFlags(null)).toEqual(DEFAULT_CONTENT_FLAGS);
  });

  it("coerces partial flags", () => {
    expect(normalizeContentFlags({ capitals: true })).toEqual({
      punctuation: false,
      numbers: false,
      capitals: true,
    });
  });
});

describe("flagsKeyFromFlags", () => {
  it("returns base when all flags are off", () => {
    expect(flagsKeyFromFlags(DEFAULT_CONTENT_FLAGS)).toBe("base");
  });

  it("returns sorted single-letter codes", () => {
    expect(
      flagsKeyFromFlags({
        punctuation: true,
        numbers: true,
        capitals: true,
      })
    ).toBe("c,n,p");
  });
});

describe("flagsKeyForMode", () => {
  it("always returns base for quote mode", () => {
    expect(
      flagsKeyForMode("quote", {
        punctuation: true,
        numbers: true,
        capitals: true,
      })
    ).toBe("base");
  });

  it("buckets time/words by enabled flags", () => {
    expect(flagsKeyForMode("time", { capitals: true, numbers: false, punctuation: false })).toBe(
      "c"
    );
  });
});

describe("labelForFlagsKey", () => {
  it("labels base and compound keys", () => {
    expect(labelForFlagsKey("base")).toBe("base");
    expect(labelForFlagsKey("c,n")).toBe("Aa 123");
    expect(labelForFlagsKey(undefined)).toBe("base");
  });
});
