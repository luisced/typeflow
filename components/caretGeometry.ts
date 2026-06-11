import type { CaretStyle } from "@/lib/types";

export const UNDERLINE_CARET_TEXT_GAP_PX = 2;
export const BAR_CARET_TEXT_GAP_PX = 2;

/** Horizontal inset so line-style carets aren't clipped at the start of a row. */
export function caretHorizontalInset(glyph: number): number {
  return Math.max(4, glyph * 0.1) + BAR_CARET_TEXT_GAP_PX;
}

export interface CaretMetrics {
  left: number;
  lineTop: number;
  lineBoxH: number;
  glyph: number;
  cell: number;
}

export interface CaretBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function computeCaretBox(
  caret: CaretMetrics,
  caretStyle: CaretStyle
): CaretBox {
  const g = caret.glyph;
  const emTop = caret.lineTop + (caret.lineBoxH - g) / 2;

  if (caretStyle === "underline") {
    const thick = Math.max(3, g * 0.09);
    return {
      left: caret.left,
      top: emTop + g + UNDERLINE_CARET_TEXT_GAP_PX,
      width: caret.cell,
      height: thick,
    };
  }

  if (caretStyle === "block" || caretStyle === "outline") {
    return {
      left: caret.left,
      top: emTop + g * 0.02,
      width: caret.cell,
      height: g * 0.94,
    };
  }

  const barWidth = Math.max(4, g * 0.1);
  return {
    left: caret.left - barWidth - BAR_CARET_TEXT_GAP_PX,
    top: emTop - 2,
    width: barWidth,
    height: g + 4,
  };
}
