"use client";

import Link from "next/link";
import { useTheme } from "@/lib/useTheme";

type ErrorStateProps = {
  status: "404" | "500";
  title: string;
  description: string;
  onRetry?: () => void;
};

function Wordmark() {
  return (
    <Link href="/" className="wordmark wordmark-btn" aria-label="TypeFlow — go home">
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
    </Link>
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
      type="button"
      className="ghost ghost-icon-only error-theme-toggle"
      aria-label="Toggle theme"
      onClick={onToggleTheme}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? (
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
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
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
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

export default function ErrorState({
  status,
  title,
  description,
  onRetry,
}: ErrorStateProps) {
  const { dark, toggle } = useTheme();

  return (
    <div className="error-page" role="main">
      <header className="error-page-header rise">
        <Wordmark />
        <ThemeToggle dark={dark} onToggleTheme={(e) => toggle(e)} />
      </header>

      <div className="error-page-body">
        <section
          className="error-state-content rise"
          style={{ animationDelay: "0.08s" }}
          aria-labelledby="error-title"
          aria-describedby="error-description"
        >
          <p className="error-state-code" aria-hidden>
            {status}
          </p>

          <div className="error-state-copy">
            <h1 className="font-display error-state-title" id="error-title">
              {title}
            </h1>
            <p className="error-state-description" id="error-description">
              {description}
            </p>
          </div>

          <div className="error-state-actions">
            {status === "500" && onRetry ? (
              <>
                <button
                  type="button"
                  className="error-primary-btn"
                  onClick={onRetry}
                >
                  Try again
                </button>
                <Link href="/" className="error-secondary-btn ghost">
                  Go home
                </Link>
              </>
            ) : (
              <>
                <Link href="/" className="error-primary-btn">
                  Go home
                </Link>
                <button
                  type="button"
                  className="error-secondary-btn ghost"
                  onClick={() => window.history.back()}
                >
                  Go back
                </button>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
