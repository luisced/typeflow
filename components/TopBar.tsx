"use client";

import { useEffect, useRef, useState } from "react";
import AccountMenu from "@/components/AccountMenu";
import type { CaretStyle, Mode, TestConfig } from "@/lib/types";

type BaseProps = {
  onOpenProfile: () => void;
  onGoHome: () => void;
  dark: boolean;
  onToggleTheme: (e: React.MouseEvent) => void;
};

type TestProps = BaseProps & {
  variant?: "test";
  config: TestConfig;
  onChange: (c: TestConfig) => void;
  disabled?: boolean;
  caretStyle: CaretStyle;
  onCaretStyle: (s: CaretStyle) => void;
};

type ProfileProps = BaseProps & {
  variant: "profile";
};

type Props = TestProps | ProfileProps;

const MODES: { key: Mode; label: string; icon: keyof typeof ICONS }[] = [
  { key: "time", label: "time", icon: "clock" },
  { key: "words", label: "words", icon: "words" },
  { key: "quote", label: "quote", icon: "quote" },
];

const ICONS = {
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 1.8" />
    </>
  ),
  words: (
    <>
      <path d="M6 19 12 5l6 14" />
      <path d="M8.5 14h7" />
    </>
  ),
  quote: (
    <>
      <path d="M7 8.5H4.5a1 1 0 0 0-1 1V12a1 1 0 0 0 1 1H7v1c0 1.4-.8 2.2-2 2.5" />
      <path d="M16.5 8.5H14a1 1 0 0 0-1 1V12a1 1 0 0 0 1 1h2.5v1c0 1.4-.8 2.2-2 2.5" />
    </>
  ),
};

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICONS[name]}
    </svg>
  );
}

const TIME_VALUES = [15, 30, 60];
const WORD_VALUES = [10, 25, 50];

const CARETS: { key: CaretStyle; label: string }[] = [
  { key: "line", label: "bar" },
  { key: "underline", label: "underline" },
  { key: "block", label: "block" },
  { key: "outline", label: "outline" },
];

function Wordmark({ asButton = false, onClick }: { asButton?: boolean; onClick?: () => void }) {
  const mark = (
    <>
      <span
        className="font-display italic text-[27px] leading-none"
        style={{ color: "var(--text)" }}
      >
        Type
      </span>
      <span
        className="font-display text-[27px] leading-none"
        style={{ color: "var(--accent)" }}
      >
        Flow
      </span>
      <span className="caret-dot" aria-hidden />
    </>
  );

  if (asButton) {
    return (
      <button
        type="button"
        className="wordmark wordmark-btn"
        onClick={onClick}
        aria-label="Back to typing test"
      >
        {mark}
      </button>
    );
  }

  return (
    <span className="wordmark" aria-label="TypeFlow">
      {mark}
    </span>
  );
}

function ThemeToggle({
  dark,
  onToggleTheme,
}: {
  dark: boolean;
  onToggleTheme: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      className="ghost ghost-icon-only"
      aria-label="Toggle theme"
      onClick={onToggleTheme}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  );
}

export default function TopBar(props: Props) {
  const { onOpenProfile, onGoHome, dark, onToggleTheme } = props;
  const isProfile = props.variant === "profile";

  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!settingsOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!settingsRef.current?.contains(e.target as Node))
        setSettingsOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [settingsOpen]);

  if (isProfile) {
    return (
      <header className="flex items-center justify-between gap-4 rise">
        <Wordmark asButton onClick={onGoHome} />
        <div className="flex items-center gap-2">
          <ThemeToggle dark={dark} onToggleTheme={onToggleTheme} />
          <AccountMenu onOpenProfile={onOpenProfile} />
        </div>
      </header>
    );
  }

  const { config, onChange, disabled, caretStyle, onCaretStyle } = props;
  const values =
    config.mode === "time"
      ? TIME_VALUES
      : config.mode === "words"
      ? WORD_VALUES
      : [];

  return (
    <header className="flex items-center justify-between gap-4 rise">
      <Wordmark asButton onClick={onGoHome} />

      <div className="seg">
        {MODES.map((m) => (
          <button
            key={m.key}
            className="chip"
            data-active={config.mode === m.key}
            disabled={disabled}
            onClick={() =>
              onChange({
                mode: m.key,
                value: m.key === "time" ? 30 : m.key === "words" ? 25 : 0,
              })
            }
          >
            <Icon name={m.icon} />
            {m.label}
          </button>
        ))}
        <span className="seg-divider" />
        <span
          key={config.mode}
          className="swap-in inline-flex items-center gap-px"
        >
          {values.length > 0 ? (
            values.map((v) => (
              <button
                key={v}
                className="chip"
                data-active={config.value === v}
                disabled={disabled}
                onClick={() => onChange({ ...config, value: v })}
              >
                {v}
              </button>
            ))
          ) : (
            <span className="chip">random</span>
          )}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative" ref={settingsRef}>
          <button
            className={`ghost ghost-icon${settingsOpen ? " ghost-active" : ""}`}
            aria-label="Caret style"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((o) => !o)}
          >
            <CaretGlyph style={caretStyle} />
            <span>caret</span>
          </button>
          {settingsOpen && (
            <div className="settings-pop pop">
              <div className="settings-label">caret style</div>
              <div className="grid grid-cols-2 gap-1.5">
                {CARETS.map((c) => (
                  <button
                    key={c.key}
                    className="caret-opt"
                    data-active={caretStyle === c.key}
                    onClick={() => onCaretStyle(c.key)}
                  >
                    <span className="caret-opt-demo">
                      <span className={`cm-${c.key}`} />
                    </span>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <ThemeToggle dark={dark} onToggleTheme={onToggleTheme} />

        <AccountMenu onOpenProfile={onOpenProfile} />
      </div>
    </header>
  );
}

function CaretGlyph({ style }: { style: CaretStyle }) {
  return (
    <span className="caret-glyph" aria-hidden>
      <span className={`cm-${style}`} />
    </span>
  );
}
