function parseLineHeightPx(style: CSSStyleDeclaration, fontSize: number): number {
  const lh = style.lineHeight;
  if (lh === "normal") return fontSize * 1.6;
  if (lh.endsWith("px")) return parseFloat(lh);
  const unitless = parseFloat(lh);
  return Number.isFinite(unitless) ? fontSize * unitless : fontSize * 1.6;
}

/** Row stride between wrapped `.type-word` lines — prefer DOM gaps over estimates. */
export function measureLineStride(
  wordEls: NodeListOf<HTMLElement>,
  sampleCell: HTMLElement
): number {
  const wordEl = sampleCell.closest(".type-word");
  const style = getComputedStyle(
    wordEl instanceof HTMLElement ? wordEl : sampleCell
  );
  const fontSize = parseFloat(style.fontSize) || 28;
  const lineBox = parseLineHeightPx(style, fontSize);

  const tops: number[] = [];
  wordEls.forEach((el) => tops.push(el.offsetTop));
  const distinct = [...new Set(tops)].sort((a, b) => a - b);

  const gaps: number[] = [];
  for (let i = 1; i < distinct.length; i++) {
    const gap = distinct[i] - distinct[i - 1];
    if (gap > 4) gaps.push(gap);
  }

  if (gaps.length > 0) {
    gaps.sort((a, b) => a - b);
    return gaps[Math.floor(gaps.length / 2)];
  }

  return lineBox;
}
