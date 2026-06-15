"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { applyKey, createState, type EngineState } from "./engine";
import { replayDurationMs } from "./replay";
import type { RunRecord } from "./types";

export type ReplaySpeed = 1 | 2;

export function useRunReplay(record: RunRecord) {
  const words = record.words!;
  const keyLog = record.keyLog!;
  const mode = record.mode;
  const durationMs = replayDurationMs(record);

  const [engine, setEngine] = useState<EngineState>(() => createState(words));
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<ReplaySpeed>(1);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [atEnd, setAtEnd] = useState(false);

  const indexRef = useRef(0);
  const timelineMsRef = useRef(0);
  const playStartRef = useRef(0);
  const speedRef = useRef<ReplaySpeed>(1);
  const engineRef = useRef(engine);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    engineRef.current = engine;
  }, [engine]);

  const clearSchedule = useCallback(() => {
    for (const id of timeoutsRef.current) clearTimeout(id);
    timeoutsRef.current = [];
    cancelAnimationFrame(rafRef.current!);
    rafRef.current = undefined;
  }, []);

  const timelineNow = useCallback(() => {
    if (!playing) return timelineMsRef.current;
    return (
      timelineMsRef.current +
      (performance.now() - playStartRef.current) * speedRef.current
    );
  }, [playing]);

  const finishReplay = useCallback(() => {
    clearSchedule();
    const endMs = Math.min(durationMs, keyLog.at(-1)?.t ?? durationMs);
    timelineMsRef.current = endMs;
    setElapsedMs(endMs);
    setPlaying(false);
    setAtEnd(true);
  }, [clearSchedule, durationMs, keyLog]);

  const applyKeyAt = useCallback(
    (idx: number) => {
      if (idx !== indexRef.current) return;

      const event = keyLog[idx];
      const eng = applyKey(engineRef.current, event.key, mode);
      engineRef.current = eng;
      setEngine(eng);
      indexRef.current = idx + 1;
      timelineMsRef.current = event.t;
      setElapsedMs(event.t);

      if (idx + 1 >= keyLog.length) {
        finishReplay();
      }
    },
    [keyLog, mode, finishReplay]
  );

  const scheduleKeys = useCallback(() => {
    clearSchedule();
    const fromIdx = indexRef.current;
    const fromMs = timelineMsRef.current;
    const spd = speedRef.current;

    for (let i = fromIdx; i < keyLog.length; i++) {
      const delay = Math.max(0, (keyLog[i].t - fromMs) / spd);
      const idx = i;
      const id = setTimeout(() => applyKeyAt(idx), delay);
      timeoutsRef.current.push(id);
    }
  }, [clearSchedule, keyLog, applyKeyAt]);

  const startClock = useCallback(() => {
    cancelAnimationFrame(rafRef.current!);
    playStartRef.current = performance.now();

    const tick = () => {
      const ms = Math.min(durationMs, timelineNow());
      setElapsedMs(ms);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [durationMs, timelineNow]);

  const resetToStart = useCallback(
    (autoPlay: boolean) => {
      clearSchedule();
      indexRef.current = 0;
      timelineMsRef.current = 0;
      playStartRef.current = performance.now();
      const fresh = createState(words);
      engineRef.current = fresh;
      setEngine(fresh);
      setElapsedMs(0);
      setAtEnd(false);
      setPlaying(autoPlay);
    },
    [clearSchedule, words]
  );

  const pause = useCallback(() => {
    if (!playing) return;
    timelineMsRef.current = timelineNow();
    setElapsedMs(timelineMsRef.current);
    clearSchedule();
    setPlaying(false);
  }, [playing, timelineNow, clearSchedule]);

  const play = useCallback(() => {
    if (atEnd) {
      resetToStart(true);
      return;
    }
    setPlaying(true);
  }, [atEnd, resetToStart]);

  const restart = useCallback(() => {
    resetToStart(false);
  }, [resetToStart]);

  const changeSpeed = useCallback(
    (next: ReplaySpeed) => {
      timelineMsRef.current = timelineNow();
      setElapsedMs(timelineMsRef.current);
      speedRef.current = next;
      setSpeed(next);
      clearSchedule();
      if (playing) {
        playStartRef.current = performance.now();
        scheduleKeys();
        startClock();
      }
    },
    [timelineNow, clearSchedule, playing, scheduleKeys, startClock]
  );

  const scheduleKeysRef = useRef(scheduleKeys);
  scheduleKeysRef.current = scheduleKeys;
  const startClockRef = useRef(startClock);
  startClockRef.current = startClock;

  useEffect(() => {
    resetToStart(true);
    return clearSchedule;
  }, [record.id, resetToStart, clearSchedule]);

  useEffect(() => {
    if (!playing) return;
    playStartRef.current = performance.now();
    scheduleKeysRef.current();
    startClockRef.current();
    return clearSchedule;
  }, [playing, clearSchedule]);

  return {
    engine,
    playing,
    speed,
    elapsedMs,
    durationMs,
    atEnd,
    pause,
    play,
    restart,
    changeSpeed,
  };
}
