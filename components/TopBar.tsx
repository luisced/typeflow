"use client";

import { useEffect, useRef, useState } from "react";
import AccountMenu from "@/components/AccountMenu";
import {
  DEFAULT_CONTENT_FLAGS,
  normalizeContentFlags,
  type ContentFlags,
} from "@/lib/contentFlags";
import type { CaretStyle, Mode, TestConfig } from "@/lib/types";

type BaseProps = {
  onOpenProfile: () => void;
  onGoHome: () => void;
  onOpenLeaderboard?: () => void;
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
  ghostEnabled?: boolean;
  onGhostToggle?: (enabled: boolean) => void;
  ghostWpm?: number | null;
  ghostAccuracy?: number | null;
};

type ProfileProps = BaseProps & {
  variant: "profile";
};

type Props = TestProps | ProfileProps;

const MODES: { key: Mode; label: string; icon: keyof typeof ICONS }[] = [
  { key: "time", label: "time", icon: "clock" },
  { key: "words", label: "words", icon: "words" },
  { key: "quote", label: "quote", icon: "quote" },
  { key: "practice", label: "practice", icon: "clock" },
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
        className="wordmark-part wordmark-part-type font-display italic leading-none"
        style={{ color: "var(--text)" }}
      >
        Type
      </span>
      <span
        className="wordmark-part wordmark-part-flow font-display leading-none"
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

function CrownIcon() {
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
      <path d="M3 18h18" />
      <path d="M5 16 8 6l4 6 4-6 3 10" />
    </svg>
  );
}

function LeaderboardButton({ onClick }: { onClick?: () => void }) {
  if (!onClick) return null;
  return (
    <button
      type="button"
      className="ghost ghost-icon"
      aria-label="Leaderboard"
      title="Leaderboard"
      onClick={onClick}
    >
      <CrownIcon />
    </button>
  );
}

function MenuToggleButton({
  open,
  onClick,
}: {
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`ghost ghost-icon-only topbar-menu-btn${open ? " ghost-active" : ""}`}
      aria-label={open ? "Close test settings" : "Open test settings"}
      aria-expanded={open}
      aria-controls="topbar-mobile-panel"
      onClick={onClick}
    >
      {open ? (
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
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      ) : (
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
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      )}
    </button>
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

type ModeSegmentProps = {
  config: TestConfig;
  onChange: (c: TestConfig) => void;
  disabled?: boolean;
  className?: string;
};

function ModeSegment({ config, onChange, disabled, className = "" }: ModeSegmentProps) {
  const flags = normalizeContentFlags(config.flags);
  const flagsDisabled = disabled || config.mode === "quote";
  const values =
    config.mode === "time" || config.mode === "practice"
      ? TIME_VALUES
      : config.mode === "words"
      ? WORD_VALUES
      : [];

  const toggleFlag = (key: keyof ContentFlags) => {
    const next = { ...flags, [key]: !flags[key] };
    onChange({ ...config, flags: next });
  };

  return (
    <div className={`seg ${className}`.trim()}>
      {MODES.map((m) => (
        <button
          key={m.key}
          className="chip"
          data-active={config.mode === m.key}
          disabled={disabled}
          onClick={() =>
            onChange({
              mode: m.key,
              value:
                m.key === "time" || m.key === "practice"
                  ? 30
                  : m.key === "words"
                  ? 25
                  : 0,
              flags: config.flags ?? DEFAULT_CONTENT_FLAGS,
            })
          }
        >
          <Icon name={m.icon} />
          {m.label}
        </button>
      ))}
      <span className="seg-divider" />
      <span className="inline-flex items-center gap-px">
        <button
          type="button"
          className="chip"
          data-active={flags.capitals}
          disabled={flagsDisabled}
          title="Capitals"
          onClick={() => toggleFlag("capitals")}
        >
          Aa
        </button>
        <button
          type="button"
          className="chip"
          data-active={flags.numbers}
          disabled={flagsDisabled}
          title="Numbers"
          onClick={() => toggleFlag("numbers")}
        >
          123
        </button>
        <button
          type="button"
          className="chip"
          data-active={flags.punctuation}
          disabled={flagsDisabled}
          title="Punctuation"
          onClick={() => toggleFlag("punctuation")}
        >
          ?!
        </button>
      </span>
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
  );
}

type CaretSettingsProps = {
  caretStyle: CaretStyle;
  onCaretStyle: (s: CaretStyle) => void;
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
  settingsRef: React.RefObject<HTMLDivElement | null>;
  layout?: "popover" | "inline";
};

function CaretSettings({
  caretStyle,
  onCaretStyle,
  settingsOpen,
  onSettingsOpenChange,
  settingsRef,
  layout = "popover",
}: CaretSettingsProps) {
  return (
    <div
      className={layout === "popover" ? "relative" : "topbar-caret-inline"}
      ref={settingsRef}
    >
      <button
        className={`ghost ghost-icon${settingsOpen ? " ghost-active" : ""}`}
        aria-label="Caret style"
        aria-expanded={settingsOpen}
        onClick={() => onSettingsOpenChange(!settingsOpen)}
      >
        <CaretGlyph style={caretStyle} />
        <span>caret</span>
      </button>
      {settingsOpen && (
        <div
          className={
            layout === "popover" ? "settings-pop pop" : "topbar-caret-panel pop"
          }
        >
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
  );
}

type ActionClusterProps = {
  onOpenProfile: () => void;
  onOpenLeaderboard?: () => void;
  dark: boolean;
  onToggleTheme: (e: React.MouseEvent) => void;
  caretStyle: CaretStyle;
  onCaretStyle: (s: CaretStyle) => void;
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
  settingsRef: React.RefObject<HTMLDivElement | null>;
  ghostEnabled?: boolean;
  onGhostToggle?: (enabled: boolean) => void;
  ghostWpm?: number | null;
  ghostAccuracy?: number | null;
  ghostVisible?: boolean;
  caretLayout?: "popover" | "inline";
  showTheme?: boolean;
  showAccount?: boolean;
  disabled?: boolean;
  className?: string;
};

function ActionCluster({
  onOpenProfile,
  onOpenLeaderboard,
  dark,
  onToggleTheme,
  caretStyle,
  onCaretStyle,
  settingsOpen,
  onSettingsOpenChange,
  settingsRef,
  ghostEnabled,
  onGhostToggle,
  ghostWpm,
  ghostAccuracy,
  ghostVisible = true,
  caretLayout = "popover",
  showTheme = true,
  showAccount = true,
  disabled,
  className = "",
}: ActionClusterProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`.trim()}>
      {ghostVisible && onGhostToggle && (
        <GhostToggle
          enabled={!!ghostEnabled}
          wpm={ghostWpm ?? null}
          accuracy={ghostAccuracy ?? null}
          disabled={!!disabled}
          onToggle={onGhostToggle}
        />
      )}
      <CaretSettings
        caretStyle={caretStyle}
        onCaretStyle={onCaretStyle}
        settingsOpen={settingsOpen}
        onSettingsOpenChange={onSettingsOpenChange}
        settingsRef={settingsRef}
        layout={caretLayout}
      />
      <LeaderboardButton onClick={onOpenLeaderboard} />
      {showTheme && <ThemeToggle dark={dark} onToggleTheme={onToggleTheme} />}
      {showAccount && <AccountMenu onOpenProfile={onOpenProfile} />}
    </div>
  );
}

export default function TopBar(props: Props) {
  const { onOpenProfile, onGoHome, onOpenLeaderboard, dark, onToggleTheme } =
    props;
  const isProfile = props.variant === "profile";

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!settingsOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!settingsRef.current?.contains(e.target as Node))
        setSettingsOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [settingsOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!mobileMenuRef.current?.contains(e.target as Node))
        setMobileMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (mq.matches) setMobileMenuOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (isProfile) {
    return (
      <header className="topbar rise">
        <div className="topbar-inner">
          <Wordmark asButton onClick={onGoHome} />
          <div className="flex items-center gap-2 shrink-0">
            <LeaderboardButton onClick={onOpenLeaderboard} />
            <ThemeToggle dark={dark} onToggleTheme={onToggleTheme} />
            <AccountMenu onOpenProfile={onOpenProfile} />
          </div>
        </div>
      </header>
    );
  }

  const {
    config,
    onChange,
    disabled,
    caretStyle,
    onCaretStyle,
    ghostEnabled,
    onGhostToggle,
    ghostWpm,
    ghostAccuracy,
  } = props;
  const showGhost = !!onGhostToggle && config.mode !== "practice";

  return (
    <header className="topbar rise" ref={mobileMenuRef}>
      <div className="topbar-inner">
        <Wordmark asButton onClick={onGoHome} />

        <ModeSegment
          config={config}
          onChange={onChange}
          disabled={disabled}
          className="topbar-seg-desktop"
        />

        <ActionCluster
          className="topbar-actions-desktop"
          onOpenProfile={onOpenProfile}
          onOpenLeaderboard={onOpenLeaderboard}
          dark={dark}
          onToggleTheme={onToggleTheme}
          caretStyle={caretStyle}
          onCaretStyle={onCaretStyle}
          settingsOpen={settingsOpen}
          onSettingsOpenChange={setSettingsOpen}
          settingsRef={settingsRef}
          ghostEnabled={ghostEnabled}
          onGhostToggle={onGhostToggle}
          ghostWpm={ghostWpm ?? null}
          ghostAccuracy={ghostAccuracy ?? null}
          ghostVisible={showGhost}
          disabled={disabled}
        />

        <div className="topbar-actions-mobile">
          <MenuToggleButton
            open={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((o) => !o)}
          />
          <ThemeToggle dark={dark} onToggleTheme={onToggleTheme} />
          <AccountMenu onOpenProfile={onOpenProfile} />
        </div>
      </div>

      {mobileMenuOpen && (
        <div
          id="topbar-mobile-panel"
          className="topbar-mobile-panel pop"
          role="region"
          aria-label="Test settings"
        >
          <ModeSegment
            config={config}
            onChange={onChange}
            disabled={disabled}
            className="topbar-seg-mobile"
          />
          <div className="topbar-mobile-panel-actions">
            <ActionCluster
              onOpenProfile={onOpenProfile}
              onOpenLeaderboard={onOpenLeaderboard}
              dark={dark}
              onToggleTheme={onToggleTheme}
              caretStyle={caretStyle}
              onCaretStyle={onCaretStyle}
              settingsOpen={settingsOpen}
              onSettingsOpenChange={setSettingsOpen}
              settingsRef={settingsRef}
              ghostEnabled={ghostEnabled}
              onGhostToggle={onGhostToggle}
              ghostWpm={ghostWpm ?? null}
              ghostAccuracy={ghostAccuracy ?? null}
              ghostVisible={showGhost}
              caretLayout="inline"
              showTheme={false}
              showAccount={false}
              disabled={disabled}
            />
          </div>
        </div>
      )}
    </header>
  );
}

function GhostIcon() {
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
      <path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z" />
      <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function GhostToggle({
  enabled,
  wpm,
  accuracy,
  disabled,
  onToggle,
}: {
  enabled: boolean;
  wpm: number | null;
  accuracy: number | null;
  disabled: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  const available = wpm != null;
  const isDisabled = disabled || !available;
  const stats =
    wpm == null
      ? null
      : accuracy == null
      ? `${wpm} wpm personal best`
      : `${wpm} wpm, ${accuracy}% acc personal best`;

  const title = isDisabled
    ? disabled
      ? "Finish or reset the test first"
      : "No personal best for this config yet"
    : enabled
    ? `Ghost racing on — ${stats}`
    : `Ghost racing off — race your ${stats}`;

  return (
    <button
      type="button"
      className={`ghost ghost-toggle ghost-icon${enabled ? " ghost-active" : ""}`}
      data-active={enabled ? "true" : undefined}
      disabled={isDisabled}
      title={title}
      aria-label={title}
      aria-pressed={enabled}
      onClick={() => onToggle(!enabled)}
    >
      <GhostIcon />
      <span className="ghost-toggle-label" aria-hidden>
        {enabled && available ? (
          <>
            <span className="ghost-toggle-wpm">{wpm}</span>
            <span className="ghost-toggle-unit"> wpm</span>
          </>
        ) : (
          "Ghost"
        )}
      </span>
    </button>
  );
}

function CaretGlyph({ style }: { style: CaretStyle }) {
  return (
    <span className="caret-glyph" aria-hidden>
      <span className={`cm-${style}`} />
    </span>
  );
}
