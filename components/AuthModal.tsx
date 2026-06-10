"use client";

import { useEffect, useId, useRef, useState } from "react";

export default function AuthModal({
  mode,
  email,
  password,
  error,
  busy,
  required = false,
  onMode,
  onEmail,
  onPassword,
  onClose,
  onSubmit,
}: {
  mode: "login" | "register";
  email: string;
  password: string;
  error: string;
  busy: boolean;
  required?: boolean;
  onMode: (m: "login" | "register") => void;
  onEmail: (v: string) => void;
  onPassword: (v: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !required) {
        e.stopPropagation();
        onClose();
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, required]);

  const title = mode === "login" ? "Sign in" : "Create account";
  const description =
    mode === "register"
      ? required
        ? "Create your account to start using this TypeFlow instance."
        : "Create an account to sync typing history."
      : "Sign in to your account.";

  return (
    <>
      <div
        className="modal-scrim fixed inset-0 z-[100]"
        onClick={required ? undefined : onClose}
        aria-hidden
      />
      <div
        ref={dialogRef}
        className="auth-modal fixed left-1/2 top-1/2 z-[110] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 panel p-6 pop"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        {!required && (
          <button
            type="button"
            className="auth-modal-close"
            aria-label="Close"
            onClick={onClose}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}

        <h2 className="font-display text-2xl mb-1" id={titleId}>
          {required && mode === "register" ? "Set up TypeFlow" : title}
        </h2>
        <p className="text-dim text-sm mb-5 leading-relaxed" id={descId}>
          {description}
        </p>

        <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
          <label className="flex flex-col gap-1 text-sm" htmlFor="auth-email">
            <span className="text-dim text-xs uppercase tracking-widest">email</span>
            <input
              ref={emailRef}
              id="auth-email"
              className="auth-input"
              type="email"
              value={email}
              onChange={(e) => onEmail(e.target.value)}
              required
              autoComplete="email"
              aria-invalid={!!error}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm" htmlFor="auth-password">
            <span className="text-dim text-xs uppercase tracking-widest">password</span>
            <div className="auth-password-wrap">
              <input
                id="auth-password"
                className="auth-input auth-input-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => onPassword(e.target.value)}
                required
                minLength={mode === "register" ? 8 : 1}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                aria-invalid={!!error}
                aria-describedby={error ? "auth-error" : undefined}
              />
              <button
                type="button"
                className="auth-password-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </label>
          {error && (
            <p className="text-error text-xs" id="auth-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="ghost w-full auth-submit"
            type="submit"
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? (
              <span className="auth-busy">
                <span className="auth-spinner" aria-hidden />
                Working…
              </span>
            ) : mode === "login" ? (
              "sign in"
            ) : (
              "create account"
            )}
          </button>
        </form>
        <button
          className="ghost w-full mt-3 text-dim"
          type="button"
          onClick={() => onMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "need an account? register" : "have an account? sign in"}
        </button>
      </div>
    </>
  );
}
