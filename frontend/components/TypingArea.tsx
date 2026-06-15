"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { charStates, EngineState } from "@/lib/engine";
import { measureLineStride } from "@/lib/typingLayout";
import type { CaretStyle } from "@/lib/types";
import {
  caretHorizontalInset,
  computeCaretBox,
  type CaretMetrics,
} from "./caretGeometry";
import { caretMotionStyle } from "./caretMotion";

interface Props {
  engine: EngineState;
  running: boolean;
  caretStyle?: CaretStyle;
  ghostCaret?: { wordIndex: number; charIndex: number } | null;
  ghostStumble?: boolean;
}

const VISIBLE_LINES = 3;

function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;

    setReducedMotion(query.matches);
    const onChange = () => setReducedMotion(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reducedMotion;
}

function AnimatedCaret({
  box,
  className,
  caretStyle,
  ghostStumble,
}: {
  box: ReturnType<typeof computeCaretBox>;
  className: string;
  caretStyle: CaretStyle;
  ghostStumble?: boolean;
}) {
  return (
    <span
      className={className}
      data-style={caretStyle}
      data-stumble={ghostStumble ? "true" : undefined}
      style={caretMotionStyle(box)}
    />
  );
}

export default function TypingArea({
  engine,
  running,
  caretStyle = "line",
  ghostCaret = null,
  ghostStumble = false,
}: Props) {
  const clipRef = useRef<HTMLDivElement>(null); // fixed-height clip
  const innerRef = useRef<HTMLDivElement>(null); // translated vertically
  const caretTargetRef = useRef<HTMLSpanElement>(null);
  const [caret, setCaret] = useState<CaretMetrics | null>(null);
  const [ghostCaretMetrics, setGhostCaretMetrics] = useState<CaretMetrics | null>(
    null
  );
  const [scrollY, setScrollY] = useState(0);
  const [lineH, setLineH] = useState(0);
  const [viewportVersion, setViewportVersion] = useState(0);
  const reducedMotion = useReducedMotion();

  const { words, typed, wordIndex } = engine;
  const activeCharIndex = (typed[wordIndex] ?? "").length;

  // Render words from the start of the buffer — never re-slice the beginning,
  // so already-laid-out words don't reflow when typing (no horizontal jitter).
  // The buffer only grows at the end (time mode), which can't shift earlier rows.
  const end = Math.min(words.length, Math.max(80, wordIndex + 40));
  const view = words.slice(0, end);

  useEffect(() => {
    const onResize = () => setViewportVersion((v) => v + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;

    // Batched read of every word's vertical position.
    const wordEls = inner.querySelectorAll<HTMLElement>(".type-word");

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

    const stride = measureLineStride(wordEls, cell);

    setLineH(stride);
    setCaret({
      left: activeWordEl.offsetLeft + cell.offsetLeft,
      lineTop: activeTop,
      lineBoxH: charH,
      glyph: fontPx,
      cell: fontPx * 0.6, // JetBrains Mono advance width
    });

    if (ghostCaret) {
      const ghostWordEl = wordEls[ghostCaret.wordIndex];
      if (ghostWordEl) {
        const ghostCells = ghostWordEl.querySelectorAll<HTMLElement>(".type-char");
        const ghostCell =
          ghostCells[
            Math.min(ghostCaret.charIndex, Math.max(0, ghostCells.length - 1))
          ];
        if (ghostCell) {
          setGhostCaretMetrics({
            left: ghostWordEl.offsetLeft + ghostCell.offsetLeft,
            lineTop: ghostWordEl.offsetTop,
            lineBoxH: ghostCell.offsetHeight,
            glyph: parseFloat(getComputedStyle(ghostCell).fontSize) || fontPx,
            cell: fontPx * 0.6,
          });
        } else {
          setGhostCaretMetrics(null);
        }
      } else {
        setGhostCaretMetrics(null);
      }
    } else {
      setGhostCaretMetrics(null);
    }

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
  }, [wordIndex, activeCharIndex, words, typed, ghostCaret, viewportVersion]);

  const caretBox = caret ? computeCaretBox(caret, caretStyle) : null;
  const ghostCaretBox = ghostCaretMetrics
    ? computeCaretBox(ghostCaretMetrics, caretStyle)
    : null;

  return (
    <div
      ref={clipRef}
      className="type-clip relative overflow-hidden select-none"
      style={
        lineH
          ? {
              height: lineH * VISIBLE_LINES,
              ...(caret
                ? { paddingLeft: caretHorizontalInset(caret.glyph) }
                : {}),
            }
          : undefined
      }
      aria-hidden
    >
      <div
        ref={innerRef}
        className="relative will-change-transform"
        style={{
          transform: `translateY(${-scrollY}px)`,
          transition: reducedMotion
            ? "none"
            : "transform 0.18s cubic-bezier(0.22,0.8,0.28,1)",
        }}
      >
        {ghostCaretBox && (
          <AnimatedCaret
            box={ghostCaretBox}
            className="caret caret-ghost"
            caretStyle={caretStyle}
            ghostStumble={ghostStumble}
          />
        )}
        {caretBox && (
          <AnimatedCaret
            box={caretBox}
            className={`caret ${running ? "" : "blink"}`}
            caretStyle={caretStyle}
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
