"use client";

import type { RunFilters } from "@/lib/api";
import type { Mode } from "@/lib/types";

const MODES: { key: Mode | ""; label: string }[] = [
  { key: "", label: "all modes" },
  { key: "time", label: "time" },
  { key: "words", label: "words" },
  { key: "quote", label: "quote" },
];

const FLAGS_KEYS = [
  { key: "", label: "all flags" },
  { key: "base", label: "base" },
  { key: "c", label: "Aa" },
  { key: "n", label: "123" },
  { key: "p", label: "?!" },
  { key: "c,n,p", label: "all on" },
];

type Props = {
  filters: RunFilters;
  onChange: (filters: RunFilters) => void;
};

export default function ProfileProgressFilters({ filters, onChange }: Props) {
  const mode = (filters as RunFilters & { mode?: Mode }).mode ?? "";
  const flagsKey = filters.flagsKey ?? "";

  const setMode = (next: Mode | "") => {
    const { mode: _m, ...rest } = filters as RunFilters & { mode?: Mode };
    onChange(next ? { ...rest, mode: next } : rest);
  };

  const setFlagsKey = (next: string) => {
    const { flagsKey: _f, ...rest } = filters;
    onChange(next ? { ...rest, flagsKey: next } : rest);
  };

  return (
    <div className="profile-progress-filters" role="group" aria-label="Progress filters">
      <span className="text-dim text-[10px] uppercase tracking-[0.16em]">
        progress
      </span>
      {MODES.map((m) => (
        <button
          key={m.key || "all"}
          type="button"
          className="chip"
          data-active={mode === m.key}
          onClick={() => setMode(m.key)}
        >
          {m.label}
        </button>
      ))}
      <span className="seg-divider" />
      {FLAGS_KEYS.map((f) => (
        <button
          key={f.key || "all-flags"}
          type="button"
          className="chip"
          data-active={flagsKey === f.key}
          onClick={() => setFlagsKey(f.key)}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
