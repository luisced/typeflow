import { describe, expect, it } from "vitest";
import {
  BAR_CARET_TEXT_GAP_PX,
  caretHorizontalInset,
  computeCaretBox,
  UNDERLINE_CARET_TEXT_GAP_PX,
  type CaretMetrics,
} from "./caretGeometry";

describe("computeCaretBox", () => {
  const caret: CaretMetrics = {
    left: 10,
    lineTop: 20,
    lineBoxH: 64,
    glyph: 40,
    cell: 24,
  };

  it("keeps the underline caret at least 2px below the glyph box", () => {
    const box = computeCaretBox(caret, "underline");
    const emTop = caret.lineTop + (caret.lineBoxH - caret.glyph) / 2;

    expect(box.top - (emTop + caret.glyph)).toBe(
      UNDERLINE_CARET_TEXT_GAP_PX
    );
  });

  it("renders the bar caret as a full-height mark before the current glyph", () => {
    const box = computeCaretBox(caret, "line");
    const emTop = caret.lineTop + (caret.lineBoxH - caret.glyph) / 2;

    expect(box.top).toBe(emTop - 2);
    expect(box.height).toBe(caret.glyph + 4);
    expect(box.width).toBeGreaterThanOrEqual(4);
    expect(caret.left - (box.left + box.width)).toBe(
      BAR_CARET_TEXT_GAP_PX
    );
  });

  it("keeps the bar caret separated at the beginning of a word", () => {
    const box = computeCaretBox({ ...caret, left: 0 }, "line");

    expect(0 - (box.left + box.width)).toBe(BAR_CARET_TEXT_GAP_PX);
  });

  it("reserves enough horizontal inset for line carets at row start", () => {
    const inset = caretHorizontalInset(40);
    const box = computeCaretBox({ ...caret, left: 0 }, "line");

    expect(box.left).toBeGreaterThanOrEqual(-inset);
    expect(inset).toBeGreaterThanOrEqual(box.width + BAR_CARET_TEXT_GAP_PX);
  });
});
