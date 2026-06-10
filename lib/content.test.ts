import { describe, expect, it } from "vitest";
import {
  QUOTES,
  initialQuote,
  initialSampleWords,
  randomQuote,
  sampleWords,
} from "./content";

describe("sampleWords", () => {
  it("returns exactly the requested count", () => {
    expect(sampleWords(10)).toHaveLength(10);
    expect(sampleWords(60)).toHaveLength(60);
  });

  it("can return more words than the source list by recycling", () => {
    const many = sampleWords(700);
    expect(many).toHaveLength(700);
  });

  it("returns plain lowercase word tokens (no spaces or empties)", () => {
    for (const w of sampleWords(100)) {
      expect(w).toMatch(/^\S+$/);
      expect(w).toBe(w.toLowerCase());
    }
  });

  it("shuffles between calls (overwhelmingly likely to differ)", () => {
    const a = sampleWords(50).join(" ");
    const b = sampleWords(50).join(" ");
    const c = sampleWords(50).join(" ");
    expect(a === b && b === c).toBe(false);
  });
});

describe("initialSampleWords", () => {
  it("is deterministic so SSR and first client render match", () => {
    expect(initialSampleWords(40)).toEqual(initialSampleWords(40));
  });

  it("returns the requested count", () => {
    expect(initialSampleWords(25)).toHaveLength(25);
  });
});

describe("quotes", () => {
  it("randomQuote returns one of the bundled quotes, split into words", () => {
    const words = randomQuote();
    expect(QUOTES).toContain(words.join(" "));
    expect(words.length).toBeGreaterThan(1);
  });

  it("randomQuote never serves the same quote twice in a row", () => {
    let prev = randomQuote().join(" ");
    for (let i = 0; i < 50; i++) {
      const next = randomQuote().join(" ");
      expect(next).not.toBe(prev);
      prev = next;
    }
  });

  it("initialQuote is deterministic (first quote)", () => {
    expect(initialQuote().join(" ")).toBe(QUOTES[0]);
  });

  it("all bundled quotes are typable single-space word streams", () => {
    for (const q of QUOTES) {
      expect(q).not.toMatch(/\s{2}/); // no double spaces
      expect(q.trim()).toBe(q);
      for (const w of q.split(" ")) expect(w.length).toBeGreaterThan(0);
    }
  });
});
