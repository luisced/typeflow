"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { charStates, EngineState } from "@/lib/engine";
import type { CaretStyle } from "@/lib/types";
import { computeCaretBox, type CaretMetrics } from "./caretGeometry";

interface Props {
  engine: EngineState;
  running: boolean;
  caretStyle?: CaretStyle;
}

const VISIBLE_LINES = 3;

export default function TypingArea({
  engine,
  running,
  caretStyle = "line",
}: Props) {
  const clipRef = useRef<HTMLDivElement>(null); // fixed-height clip
  const innerRef = useRef<HTMLDivElement>(null); // translated vertically
  const caretTargetRef = useRef<HTMLSpanElement>(null);
  const [caret, setCaret] = useState<CaretMetrics | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const [lineH, setLineH] = useState(0);

  const { words, typed, wordIndex } = engine;
  const activeCharIndex = (typed[wordIndex] ?? "").length;

  // Render words from the start of the buffer — never re-slice the beginning,
  // so already-laid-out words don't reflow when typing (no horizontal jitter).
  // The buffer only grows at the end (time mode), which can't shift earlier rows.
  const end = Math.min(words.length, Math.max(80, wordIndex + 40));
  const view = words.slice(0, end);

  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;

    // Batched read of every word's vertical position.
    const wordEls = inner.querySelectorAll<HTMLElement>(".type-word");
    const tops: number[] = [];
    wordEls.forEach((el) => tops.push(el.offsetTop));

    // Locate the active character cell directly from the DOM (do NOT rely on a
    // React ref — it can lag the active position during fast typing).
    const activeWordEl = wordEls[wordIndex];
    if (!activeWordEl) return;
    const cells = activeWordEl.querySelectorAll<HTMLElement>(".type-char");
    const cell = cells[Math.min(activeCharIndex, cells.length - 1)];
    if (!cell) return;

    const fontPx = parseFloat(getComputedStyle(cell).fontSize) || 40;
    const charH = cell.offsetHeight; // glyph line box (for caret centering)
    const activeTop = activeWordEl.offsetTop;

    // The real line stride includes the word's margin — derive it from the
    // distinct row positions (char offsetHeight alone is too small).
    const distinct = [...new Set(tops)].sort((a, b) => a - b);
    let stride = charH * 1.25;
    for (let i = 1; i < distinct.length; i++) {
      const d = distinct[i] - distinct[i - 1];
      if (d > 4) {
        stride = d;
        break;
      }
    }

    setLineH(stride);
    setCaret({
      left: activeWordEl.offsetLeft + cell.offsetLeft,
      lineTop: activeTop,
      lineBoxH: charH,
      glyph: fontPx,
      cell: fontPx * 0.6, // JetBrains Mono advance width
    });

    // Keep one completed line above the active line; scroll by whole lines.
    const activeLineIndex = Math.round(activeTop / stride);
    setScrollY(Math.max(0, activeLineIndex - 1) * stride);

    // Clear any leftover transforms (e.g. from a previous session).
    wordEls.forEach((el) => {
      if (el.style.transform) {
        el.style.transform = "";
        el.style.opacity = "";
        el.style.filter = "";
        el.style.transformOrigin = "";
      }
    });
  }, [wordIndex, activeCharIndex, words, typed]);

  const caretBox = caret ? computeCaretBox(caret, caretStyle) : null;

  return (
    <div
      ref={clipRef}
      className="type-clip relative overflow-hidden select-none"
      style={{ height: lineH ? lineH * VISIBLE_LINES : "clamp(168px, 20.4vw, 240px)" }}
      aria-hidden
    >
      <div
        ref={innerRef}
        className="relative will-change-transform"
        style={{
          transform: `translateY(${-scrollY}px)`,
          transition: "transform 0.18s cubic-bezier(0.22,0.8,0.28,1)",
        }}
      >
        {caretBox && (
          <span
            className={`caret ${running ? "" : "blink"}`}
            data-style={caretStyle}
            style={{
              left: caretBox.left,
              top: caretBox.top,
              width: caretBox.width,
              height: caretBox.height,
            }}
          />
        )}
        {view.map((word, wi) => {
          const typedWord = typed[wi] ?? "";
          const states = charStates(word, typed[wi]);
          const isActive = wi === wordIndex;
          const cellCount = Math.max(states.length, activeCharIndex + 1);
          const hasTypo = states.some(
            (state) => state === "incorrect" || state === "extra"
          );
          const showTypoUnderline = wi < wordIndex && hasTypo;

          return (
            <span
              key={wi}
              className="type-word"
              data-has-typo={showTypoUnderline ? "true" : undefined}
            >
              {Array.from({ length: cellCount }).map((_, ci) => {
                const s = states[ci];
                const ch =
                  ci < word.length ? word[ci] : typedWord[ci] ?? "";
                const isCaretCell = isActive && ci === activeCharIndex;
                // trailing empty cell (caret at end of word)
                if (ci >= states.length) {
                  return (
                    <span
                      key={ci}
                      className="type-char"
                      data-s="untyped"
                      ref={isCaretCell ? caretTargetRef : undefined}
                    >
                      {"​"}
                    </span>
                  );
                }
                return (
                  <span
                    key={ci}
                    className="type-char"
                    data-s={s}
                    ref={isCaretCell ? caretTargetRef : undefined}
                  >
                    {ch}
                  </span>
                );
              })}
            </span>
          );
        })}
      </div>
    </div>
  );
}
