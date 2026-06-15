"use client";

import type { RunFilters } from "@/lib/api";
import { KEYBOARD_LAYOUTS, layoutLabel } from "@/lib/keyboards";
import { useKeyboards } from "@/lib/useKeyboards";
import type { KeyboardLayout } from "@/lib/types";

interface Props {
  filters: RunFilters;
  onChange: (filters: RunFilters) => void;
}

function FilterIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

export default function KeyboardFilterBar({ filters, onChange }: Props) {
  const { keyboards } = useKeyboards();
  const hasFilters = !!(filters.keyboardId || filters.layout);

  return (
    <div className="filter-bar" role="toolbar" aria-label="Filter stats and history">
      <span className="filter-bar-label">
        <FilterIcon />
        Filter
      </span>
      <div className="filter-bar-controls">
        {keyboards.length > 0 && (
          <label className="filter-field">
            <span className="filter-field-label">Keyboard</span>
            <select
              className="filter-select"
              value={filters.keyboardId ?? ""}
              onChange={(e) =>
                onChange({
                  ...filters,
                  keyboardId: e.target.value || undefined,
                })
              }
            >
              <option value="">All</option>
              {keyboards.map((kb) => (
                <option key={kb.id} value={kb.id}>
                  {kb.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="filter-field">
          <span className="filter-field-label">Layout</span>
          <select
            className="filter-select"
            value={filters.layout ?? ""}
            onChange={(e) =>
              onChange({
                ...filters,
                layout: (e.target.value as KeyboardLayout) || undefined,
              })
            }
          >
            <option value="">All</option>
            {KEYBOARD_LAYOUTS.map((l) => (
              <option key={l} value={l}>
                {layoutLabel(l)}
              </option>
            ))}
          </select>
        </label>
        {hasFilters && (
          <button
            type="button"
            className="filter-clear"
            onClick={() => onChange({})}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
