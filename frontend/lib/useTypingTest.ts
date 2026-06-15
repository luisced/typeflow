"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyKey,
  appendWords,
  correctChars,
  createState,
  EngineState,
} from "./engine";
import {
  initialPracticeWords,
  initialQuote,
  initialSampleWords,
  practiceSampleWords,
  randomQuote,
  sampleWords,
} from "./content";
import { maybeStoreGhostPb } from "./ghost";
import { flagsKeyForMode, normalizeContentFlags } from "./contentFlags";
import { targetKeysForPractice, weaknessForChar } from "./weakness";
import {
  computeAccuracy,
  computeConsistency,
  computeWpm,
  isMissKeystroke,
  totalTypedChars,
} from "./stats";
import { loadHistory, personalBest, saveRun } from "./storage";
import { getActiveKeyboardId } from "./keyboards";
import { queueRun, syncNow } from "./sync";
import type { RunRecord, TestConfig, KeyEvent } from "./types";

type Phase = "idle" | "running" | "finished" | "paused";

function practiceWords(config: TestConfig): string[] {
  const flags = normalizeContentFlags(config.flags);
  const history = loadHistory();
  const targets = targetKeysForPractice(history);
  const score = (ch: string) => weaknessForChar(ch, history);
  return practiceSampleWords(60, targets, score, flags);
}

function buildWords(config: TestConfig): string[] {
  if (config.mode === "quote") return randomQuote();
  if (config.mode === "practice") return practiceWords(config);
  const flags = normalizeContentFlags(config.flags);
  if (config.mode === "words") return sampleWords(config.value, flags);
  return sampleWords(60, flags); // time mode: seed, extended on demand
}

function buildInitialWords(config: TestConfig): string[] {
  if (config.mode === "quote") return initialQuote();
  if (config.mode === "practice") {
    return initialPracticeWords(60, normalizeContentFlags(config.flags));
  }
  const flags = normalizeContentFlags(config.flags);
  if (config.mode === "words") return initialSampleWords(config.value, flags);
  return initialSampleWords(60, flags);
}

export interface TestResult {
  record: RunRecord;
  isPB: boolean;
  prevBest: number;
}

export function useTypingTest(config: TestConfig) {
  // Seed deterministic content for the first render so the typing area is
  // never blank before client effects run or after hot-refresh edge cases.
  const [engine, setEngine] = useState<EngineState>(() =>
    createState(buildInitialWords(config))
  );
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0); // seconds, fractional
  const [result, setResult] = useState<TestResult | null>(null);

  const startRef = useRef<number | null>(null);
  const samplesRef = useRef<number[]>([]);
  const rawSamplesRef = useRef<number[]>([]);
  const correctSamplesRef = useRef<number[]>([]);
  const typedSamplesRef = useRef<number[]>([]);
  const errorSecondsRef = useRef<number[]>([]);
  const keylogRef = useRef<KeyEvent[]>([]);
  const lastSampleSec = useRef(0);
  const engineRef = useRef(engine);
  useEffect(() => {
    engineRef.current = engine;
  }, [engine]);
  const rafRef = useRef<number | undefined>(undefined);

  // Swap the deterministic SSR seed for randomized content once mounted,
  // as long as the user hasn't started typing yet.
  useEffect(() => {
    setEngine((prev) =>
      prev.totalKeystrokes === 0 && prev.wordIndex === 0
        ? createState(buildWords(config))
        : prev
    );
    // mount only — config changes go through reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = useCallback(
    (next?: TestConfig) => {
      const cfg = next ?? config;
      const fresh = createState(buildWords(cfg));
      engineRef.current = fresh;
      setEngine(fresh);
      setPhase("idle");
      setElapsed(0);
      setResult(null);
      startRef.current = null;
      samplesRef.current = [];
      rawSamplesRef.current = [];
      correctSamplesRef.current = [];
      typedSamplesRef.current = [];
      errorSecondsRef.current = [];
      keylogRef.current = [];
      lastSampleSec.current = 0;
    },
    [config]
  );

  const finish = useCallback(
    (finalEngine: EngineState, durationSec: number) => {
      const correct = correctChars(finalEngine);
      const typedChars = totalTypedChars(finalEngine);
      const { wpm, raw } = computeWpm(correct, typedChars, durationSec || 0.001);
      const accuracy = computeAccuracy(finalEngine);
      const consistency = computeConsistency(samplesRef.current);

      const flags = normalizeContentFlags(config.flags);
      const flagsKey = flagsKeyForMode(config.mode, flags);
      const history = loadHistory();
      const prevBest = personalBest(
        history,
        config.mode,
        config.value,
        undefined,
        flagsKey
      );

      const practiceTargets =
        config.mode === "practice"
          ? targetKeysForPractice(loadHistory())
          : undefined;

      const record: RunRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        mode: config.mode,
        value: config.value,
        wpm,
        raw,
        accuracy,
        consistency,
        durationSec: Math.round(durationSec * 10) / 10,
        date: Date.now(),
        errorMap: finalEngine.errorMap,
        keyMap: finalEngine.keyMap,
        samples: samplesRef.current.slice(),
        rawSamples: rawSamplesRef.current.slice(),
        errorSeconds: errorSecondsRef.current.slice(),
        keyLog: keylogRef.current.slice(),
        words: finalEngine.words.slice(),
        flags,
        flagsKey,
        ...(config.mode === "practice"
          ? {
              isComparable: false,
              practice: { targetKeys: practiceTargets },
            }
          : {}),
        ...(getActiveKeyboardId()
          ? { keyboardId: getActiveKeyboardId() }
          : {}),
      };
      const isPB = wpm > prevBest && wpm > 0;
      saveRun(record);
      maybeStoreGhostPb(record, isPB);
      queueRun(record.id);
      void syncNow();
      setResult({ record, isPB, prevBest });
      setPhase("finished");
    },
    [config]
  );

  // animation-frame timer: updates elapsed, records per-second samples,
  // and ends time-mode runs. Keeps running while paused — pause guards
  // against stray keystrokes but never stops the clock (no free rest time).
  useEffect(() => {
    if (phase !== "running" && phase !== "paused") return;

    const tick = () => {
      const start = startRef.current;
      if (start == null) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const now = performance.now();
      const sec = (now - start) / 1000;
      setElapsed(sec);

      // sample WPM each whole second
      const whole = Math.floor(sec);
      if (whole > lastSampleSec.current) {
        for (let s = lastSampleSec.current + 1; s <= whole; s++) {
          const eng = engineRef.current;
          const correct = correctChars(eng);
          const typed = totalTypedChars(eng);
          // instantaneous WPM for this second = chars typed *in* this
          // second (delta vs previous cumulative sample), not the
          // cumulative average — the graph and consistency rely on it
          const prevCorrect = s >= 2 ? correctSamplesRef.current[s - 2] ?? 0 : 0;
          const prevTyped = s >= 2 ? typedSamplesRef.current[s - 2] ?? 0 : 0;
          correctSamplesRef.current[s - 1] = correct;
          typedSamplesRef.current[s - 1] = typed;
          const deltaCorrect = Math.max(0, correct - prevCorrect);
          const deltaTyped = Math.max(0, typed - prevTyped);
          samplesRef.current[s - 1] = Math.round((deltaCorrect / 5) * 60);
          rawSamplesRef.current[s - 1] = Math.round((deltaTyped / 5) * 60);
        }
        lastSampleSec.current = whole;
      }

      if (
        (config.mode === "time" || config.mode === "practice") &&
        sec >= config.value
      ) {
        cancelAnimationFrame(rafRef.current!);
        finish(engineRef.current, config.value);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current!);
  }, [phase, config, finish]);

  // Records a key event into the keylog and, if it's a miss, into errorSeconds.
  // Must only be called when startRef.current is non-null.
  const recordKey = useCallback(
    (prev: EngineState, next: EngineState, key: string) => {
      const start = startRef.current;
      if (start == null || prev === next) return;
      const t = performance.now() - start;
      const miss = isMissKeystroke(prev, next);
      keylogRef.current.push({ key, t: Math.round(t * 10) / 10, ok: !miss });
      if (miss) {
        errorSecondsRef.current.push(Math.floor(t / 1000));
      }
    },
    []
  );

  const applyAndRecordKey = useCallback(
    (key: string) => {
      const prev = engineRef.current;
      const applied = applyKey(prev, key, config.mode);
      recordKey(prev, applied, key);

      let next = applied;
      // keep an endless stream for time mode
      if (
        (config.mode === "time" || config.mode === "practice") &&
        next.wordIndex >= next.words.length - 10
      ) {
        const more =
          config.mode === "practice"
            ? practiceWords(config).slice(0, 30)
            : sampleWords(30, normalizeContentFlags(config.flags));
        next = appendWords(next, more);
      }

      if (next !== prev) {
        engineRef.current = next;
        setEngine(next);
      }
    },
    [config, recordKey]
  );

  const onKey = useCallback(
    (key: string) => {
      if (phase === "finished" || phase === "paused") return;

      // start on first printable key
      if (startRef.current == null) {
        if (key === "Backspace" || key === " " || key.length !== 1) return;
        startRef.current = performance.now();
        setPhase("running");
      }

      applyAndRecordKey(key);
    },
    [phase, applyAndRecordKey]
  );

  const resumeWithKey = useCallback(
    (key: string) => {
      if (phase !== "paused") {
        onKey(key);
        return;
      }

      // no start-time shift: paused time stays on the clock
      setPhase("running");
      applyAndRecordKey(key);
    },
    [phase, onKey, applyAndRecordKey]
  );

  // finish word/quote runs once the engine reports completion
  useEffect(() => {
    if (
      phase !== "running" ||
      !engine.finished ||
      config.mode === "time" ||
      config.mode === "practice"
    )
      return;
    const dur = startRef.current
      ? (performance.now() - startRef.current) / 1000
      : elapsed;
    finish(engine, dur);
  }, [engine.finished, phase, config.mode, engine, elapsed, finish]);

  const pause = useCallback(() => {
    setPhase((p) => (p === "running" ? "paused" : p));
  }, []);
  const resume = useCallback(() => {
    // no start-time shift: paused time stays on the clock
    setPhase((p) => (p === "paused" ? "running" : p));
  }, []);

  const remaining =
    config.mode === "time" || config.mode === "practice"
      ? Math.max(0, config.value - elapsed)
      : null;

  return {
    engine,
    phase,
    elapsed,
    remaining,
    result,
    onKey,
    reset,
    pause,
    resume,
    resumeWithKey,
    // elapsed is already in the return below, just making sure liveWpm/liveAccuracy
    // use it correctly.
    // Don't show WPM until 3s in — avoids the wild values at the start.
    // After 3s, smooth with a 5s rolling window so it doesn't thrash.
    liveWpm: (() => {
      if (elapsed < 3) return 0;
      const correct = correctChars(engine);
      if (elapsed <= 5) {
        return computeWpm(correct, correct, elapsed).wpm;
      }

      const trailingWindow = 5;
      const baseline =
        correctSamplesRef.current[
          Math.max(0, Math.floor(elapsed) - trailingWindow) - 1
        ] ?? 0;
      const recentCorrect = Math.max(0, correct - baseline);
      return computeWpm(recentCorrect, recentCorrect, trailingWindow).wpm;
    })(),
    liveAccuracy: computeAccuracy(engine),
  };
}
