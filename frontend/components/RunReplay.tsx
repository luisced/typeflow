"use client";

import TypingArea from "./TypingArea";
import { formatReplayClock } from "@/lib/replay";
import { useRunReplay } from "@/lib/useRunReplay";
import type { CaretStyle, RunRecord } from "@/lib/types";

interface Props {
  record: RunRecord;
  caretStyle?: CaretStyle;
}

export default function RunReplay({ record, caretStyle = "line" }: Props) {
  const {
    engine,
    playing,
    speed,
    elapsedMs,
    durationMs,
    pause,
    play,
    restart,
    changeSpeed,
  } = useRunReplay(record);

  return (
    <section className="run-replay panel p-6 rise" aria-label="Session replay">
      <div className="run-replay-header mb-4">
        <span className="text-dim text-[11px] uppercase tracking-[0.2em]">
          replay
        </span>
      </div>

      <div className="run-replay-stage">
        <TypingArea engine={engine} running={playing} caretStyle={caretStyle} />
      </div>

      <div className="run-replay-controls">
        <button
          type="button"
          className="ghost"
          onClick={playing ? pause : play}
          aria-label={playing ? "Pause replay" : "Play replay"}
        >
          {playing ? "pause" : "play"}
        </button>
        <button
          type="button"
          className="ghost"
          onClick={restart}
          aria-label="Restart replay"
        >
          ↺ restart
        </button>
        <div className="run-replay-speed" role="group" aria-label="Playback speed">
          {([1, 2] as const).map((s) => (
            <button
              key={s}
              type="button"
              className="ghost run-replay-speed-btn"
              data-active={speed === s ? "true" : undefined}
              onClick={() => changeSpeed(s)}
              aria-pressed={speed === s}
            >
              {s}×
            </button>
          ))}
        </div>
        <span className="run-replay-time" aria-live="polite">
          {formatReplayClock(elapsedMs, durationMs)}
        </span>
      </div>
    </section>
  );
}
