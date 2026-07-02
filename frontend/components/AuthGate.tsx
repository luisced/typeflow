"use client";

import { useEffect, useId, useRef, useState } from "react";
import { NetworkError, login, register } from "@/lib/api";
import {
  DISPLAY_NAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
  type AuthField,
  type AuthFieldErrors,
  firstInvalidField,
  validateAuthForm,
  validateDisplayName,
  validateEmail,
  validateIdentifier,
  validatePassword,
  validateUsername,
} from "@/lib/authValidation";
import { onLogin } from "@/lib/sync";

const EMPTY_ERRORS: AuthFieldErrors = {};

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p className="auth-field-error" id={id} role="alert">
      {message}
    </p>
  );
}

export default function AuthGate({ onClose }: { onClose?: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>(EMPTY_ERRORS);
  const [apiError, setApiError] = useState("");
  const [networkError, setNetworkError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const displayNameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const identifierErrorId = useId();
  const emailErrorId = useId();
  const usernameErrorId = useId();
  const displayNameErrorId = useId();
  const passwordErrorId = useId();
  const apiErrorId = useId();

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const clearFieldError = (field: AuthField) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validateField = (field: AuthField) => {
    const message =
      field === "identifier"
        ? validateIdentifier(identifier)
        : field === "email"
          ? validateEmail(email)
          : field === "username"
            ? validateUsername(username)
            : field === "displayName"
              ? validateDisplayName(displayName)
              : validatePassword(password, mode);
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
    return !message;
  };

  const focusField = (field: AuthField) => {
    const refs: Record<AuthField, React.RefObject<HTMLInputElement | null>> = {
      identifier: firstFieldRef,
      email: firstFieldRef,
      username: usernameRef,
      displayName: displayNameRef,
      password: passwordRef,
    };
    refs[field].current?.focus();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError("");
    setNetworkError("");
    const errors = validateAuthForm(
      { identifier, email, password, username, displayName },
      mode
    );
    setFieldErrors(errors);
    const invalid = firstInvalidField(errors, mode);
    if (invalid) {
      focusField(invalid);
      return;
    }

    setBusy(true);
    try {
      if (mode === "register") {
        await register({
          email: email.trim(),
          username,
          displayName,
          password,
        });
      } else {
        await login(identifier, password);
      }
      await onLogin();
      setIdentifier("");
      setEmail("");
      setUsername("");
      setDisplayName("");
      setPassword("");
      setFieldErrors(EMPTY_ERRORS);
    } catch (err) {
      if (err instanceof NetworkError) {
        setNetworkError(err.message);
      } else {
        setApiError(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    setMode((m) => (m === "login" ? "register" : "login"));
    setFieldErrors(EMPTY_ERRORS);
    setApiError("");
    setNetworkError("");
  };

  return (
    <div className="auth-page" role="main">
      <header className="auth-page-header rise">
        <div className="wordmark" aria-label="TypeFlow">
          <span className="font-display italic" style={{ fontSize: 28, color: "var(--text)" }}>
            Type
          </span>
          <span className="font-display" style={{ fontSize: 28, color: "var(--accent)" }}>
            Flow
          </span>
          <span className="caret-dot" aria-hidden />
        </div>
      </header>

      <main className="auth-page-body">
        <div className="auth-card pop" aria-labelledby={titleId}>
          <div className="auth-card-stripe" aria-hidden />

          <div className="auth-card-content">
            <div className="auth-card-heading">
              <h1 className="font-display auth-card-title" id={titleId}>
                {mode === "register" ? "Set up TypeFlow" : "Welcome back"}
              </h1>
              <p className="auth-card-sub">
                {mode === "register"
                  ? "Create an account to sync your runs across devices and join the leaderboard."
                  : "Sign in to your account."}
              </p>
            </div>

            {networkError && (
              <div className="auth-network-error" role="alert">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden style={{ flexShrink: 0, marginTop: 1 }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>{networkError}</span>
              </div>
            )}

            <form onSubmit={submit} className="auth-card-form" noValidate>
              {mode === "login" ? (
                <div className="auth-field">
                  <label className="auth-field-label" htmlFor="auth-identifier">
                    Email or username
                  </label>
                  <input
                    ref={firstFieldRef}
                    id="auth-identifier"
                    className={`auth-input${fieldErrors.identifier ? " auth-input--invalid" : ""}`}
                    type="text"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      clearFieldError("identifier");
                      setApiError("");
                      setNetworkError("");
                    }}
                    onBlur={() => validateField("identifier")}
                    required
                    autoComplete="username"
                    placeholder="you@example.com or @handle"
                    aria-invalid={!!fieldErrors.identifier}
                    aria-describedby={fieldErrors.identifier ? identifierErrorId : undefined}
                  />
                  {fieldErrors.identifier && (
                    <FieldError id={identifierErrorId} message={fieldErrors.identifier} />
                  )}
                </div>
              ) : (
                <div className="auth-field">
                  <label className="auth-field-label" htmlFor="auth-email">
                    Email
                  </label>
                  <input
                    ref={firstFieldRef}
                    id="auth-email"
                    className={`auth-input${fieldErrors.email ? " auth-input--invalid" : ""}`}
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      clearFieldError("email");
                      setApiError("");
                      setNetworkError("");
                    }}
                    onBlur={() => validateField("email")}
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={fieldErrors.email ? emailErrorId : undefined}
                  />
                  {fieldErrors.email && (
                    <FieldError id={emailErrorId} message={fieldErrors.email} />
                  )}
                </div>
              )}

              {mode === "register" && (
                <>
                  <div className="auth-field">
                    <label className="auth-field-label" htmlFor="auth-username">
                      Username
                      <span className="auth-field-hint">
                        {USERNAME_MIN}–{USERNAME_MAX} chars
                      </span>
                    </label>
                    <input
                      ref={usernameRef}
                      id="auth-username"
                      className={`auth-input${fieldErrors.username ? " auth-input--invalid" : ""}`}
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        clearFieldError("username");
                        setApiError("");
                      }}
                      onBlur={() => validateField("username")}
                      required
                      autoComplete="username"
                      placeholder="luis_ced"
                      minLength={USERNAME_MIN}
                      maxLength={USERNAME_MAX}
                      aria-invalid={!!fieldErrors.username}
                      aria-describedby={
                        fieldErrors.username ? usernameErrorId : undefined
                      }
                    />
                    {fieldErrors.username && (
                      <FieldError
                        id={usernameErrorId}
                        message={fieldErrors.username}
                      />
                    )}
                  </div>

                  <div className="auth-field">
                    <label
                      className="auth-field-label"
                      htmlFor="auth-display-name"
                    >
                      Display name
                      <span className="auth-field-hint">
                        max {DISPLAY_NAME_MAX} chars
                      </span>
                    </label>
                    <input
                      ref={displayNameRef}
                      id="auth-display-name"
                      className={`auth-input${fieldErrors.displayName ? " auth-input--invalid" : ""}`}
                      type="text"
                      value={displayName}
                      onChange={(e) => {
                        setDisplayName(e.target.value);
                        clearFieldError("displayName");
                        setApiError("");
                      }}
                      onBlur={() => validateField("displayName")}
                      required
                      autoComplete="name"
                      placeholder="Luis Cedillo"
                      maxLength={DISPLAY_NAME_MAX}
                      aria-invalid={!!fieldErrors.displayName}
                      aria-describedby={
                        fieldErrors.displayName ? displayNameErrorId : undefined
                      }
                    />
                    {fieldErrors.displayName && (
                      <FieldError
                        id={displayNameErrorId}
                        message={fieldErrors.displayName}
                      />
                    )}
                  </div>
                </>
              )}

              <div className="auth-field">
                <label className="auth-field-label" htmlFor="auth-password">
                  Password
                  {mode === "register" && (
                    <span className="auth-field-hint">
                      {PASSWORD_MIN}–{PASSWORD_MAX} characters
                    </span>
                  )}
                </label>
                <div className="auth-password-wrap">
                  <input
                    ref={passwordRef}
                    id="auth-password"
                    className={`auth-input auth-input-password${fieldErrors.password ? " auth-input--invalid" : ""}`}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearFieldError("password");
                      setApiError("");
                    }}
                    onBlur={() => validateField("password")}
                    required
                    minLength={mode === "register" ? PASSWORD_MIN : 1}
                    maxLength={PASSWORD_MAX}
                    autoComplete={
                      mode === "register" ? "new-password" : "current-password"
                    }
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={
                      fieldErrors.password ? passwordErrorId : undefined
                    }
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
                {fieldErrors.password && (
                  <FieldError id={passwordErrorId} message={fieldErrors.password} />
                )}
              </div>

              {apiError && (
                <p className="auth-error" id={apiErrorId} role="alert">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden style={{ flexShrink: 0, marginTop: 1 }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {apiError}
                </p>
              )}

              <button
                type="submit"
                className="auth-submit-btn"
                disabled={busy}
                aria-busy={busy}
              >
                {busy ? (
                  <span className="auth-busy">
                    <span className="auth-spinner" aria-hidden />
                    Working…
                  </span>
                ) : mode === "login" ? (
                  "Sign in"
                ) : (
                  "Create account"
                )}
              </button>
            </form>
          </div>
        </div>

        <button type="button" className="auth-mode-switch" onClick={switchMode}>
          {mode === "login"
            ? "Don't have an account? Register"
            : "Already have an account? Sign in"}
        </button>

        {onClose && (
          <button
            type="button"
            className="auth-guest-link"
            onClick={onClose}
          >
            ← continue as guest
          </button>
        )}
      </main>

      <footer className="auth-page-footer rise" style={{ animationDelay: "0.2s" }}>
        <span className="text-dim" style={{ fontSize: 11 }}>
          Your own TypeFlow instance
        </span>
      </footer>
    </div>
  );
}
