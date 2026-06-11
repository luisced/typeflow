/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { measureLineStride } from "@/lib/typingLayout";

function mockWord(top: number): HTMLElement {
  const el = document.createElement("span");
  Object.defineProperty(el, "offsetTop", { value: top });
  return el;
}

describe("measureLineStride", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the median gap between wrapped rows when available", () => {
    const words = [mockWord(0), mockWord(0), mockWord(45), mockWord(90), mockWord(90)];
    const cell = document.createElement("span");
    const word = document.createElement("span");
    word.className = "type-word";
    word.appendChild(cell);

    Object.defineProperty(cell, "closest", {
      value: () => word,
    });

    const style = {
      fontSize: "28px",
      lineHeight: "1.6",
    } as CSSStyleDeclaration;

    vi.spyOn(window, "getComputedStyle").mockReturnValue(style);

    expect(
      measureLineStride(words as unknown as NodeListOf<HTMLElement>, cell)
    ).toBe(45);
  });

  it("falls back to computed line-height when only one row exists", () => {
    const words = [mockWord(0), mockWord(0)];
    const cell = document.createElement("span");
    const word = document.createElement("span");
    word.className = "type-word";
    word.appendChild(cell);

    Object.defineProperty(cell, "closest", {
      value: () => word,
    });

    const style = {
      fontSize: "28px",
      lineHeight: "1.6",
    } as CSSStyleDeclaration;

    vi.spyOn(window, "getComputedStyle").mockReturnValue(style);

    expect(
      measureLineStride(words as unknown as NodeListOf<HTMLElement>, cell)
    ).toBeCloseTo(44.8);
  });
});
