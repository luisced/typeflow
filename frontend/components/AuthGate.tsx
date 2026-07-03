"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  NetworkError,
  login,
  register,
  requestPasswordReset,
} from "@/lib/api";
import {
  DISPLAY_NAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
  firstInvalidField,
  normalizeUsernameInput,
  passwordStrengthChecks,
  passwordStrengthLabel,
  type AuthField,
  type AuthFieldErrors,
  type AuthMode,
  type PasswordStrength,
  validateAuthForm,
  validateConfirmPassword,
  validateDisplayName,
  validateEmail,
  validateIdentifier,
  validatePassword,
  validateUsername,
} from "@/lib/authValidation";
import { onLogin } from "@/lib/sync";

const EMPTY_ERRORS: AuthFieldErrors = {};
const LOGIN_DRAFT_KEY = "typeflow.auth.login-draft.v1";
const REGISTER_DRAFT_KEY = "typeflow.auth.register-draft.v1";
const IDENTIFIER_KEY = "typeflow.auth.identifier.v1";

type LoginDraft = {
  identifier: string;
  password: string;
};

type RegisterDraft = {
  email: string;
  username: string;
  displayName: string;
  password: string;
  confirmPassword: string;
};

type GuidanceState = "neutral" | "success" | "error";

const EMPTY_LOGIN_DRAFT: LoginDraft = {
  identifier: "",
  password: "",
};

const EMPTY_REGISTER_DRAFT: RegisterDraft = {
  email: "",
  username: "",
  displayName: "",
  password: "",
  confirmPassword: "",
};

function readSessionStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeSessionStorage(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore private mode / quota issues */
  }
}

function writeSessionString(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* ignore private mode / quota issues */
  }
}

function isEmailValue(value: string): boolean {
  return validateEmail(value) === null;
}

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p className="auth-field-error" id={id} role="alert">
      {message}
    </p>
  );
}

function SummaryError({
  title,
  lines,
}: {
  title: string;
  lines: string[];
}) {
  return (
    <div className="auth-error auth-error-summary" role="alert">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden
        style={{ flexShrink: 0, marginTop: 1 }}
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div className="auth-error-copy">
        <strong>{title}</strong>
        <ul className="auth-error-list">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function GuidanceIcon({ state }: { state: GuidanceState }) {
  if (state === "success") {
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
        <path d="m5 13 4 4L19 7" />
      </svg>
    );
  }
  if (state === "error") {
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
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    );
  }
  return <span className="auth-guidance-dot" aria-hidden />;
}

function GuidanceItem({
  state,
  children,
}: {
  state: GuidanceState;
  children: React.ReactNode;
}) {
  return (
    <li className="auth-guidance-item" data-state={state}>
      <span className="auth-guidance-icon">
        <GuidanceIcon state={state} />
      </span>
      <span>{children}</span>
    </li>
  );
}

function TypingSupportText({ text }: { text: string }) {
  const [visible, setVisible] = useState(text);

  useEffect(() => {
    if (typeof window === "undefined") {
      setVisible(text);
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setVisible(text);
      return;
    }

    setVisible("");
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setVisible(text.slice(0, index));
      if (index >= text.length) window.clearInterval(timer);
    }, 14);

    return () => window.clearInterval(timer);
  }, [text]);

  return (
    <span className="auth-typing-text">
      {visible}
      <span className="auth-typing-caret" aria-hidden />
    </span>
  );
}

function strengthDescription(strength: PasswordStrength): string {
  switch (strength) {
    case "strong":
      return "Strong";
    case "good":
      return "Good";
    case "fair":
      return "Fair";
    default:
      return "Weak";
  }
}

export default function AuthGate({ onClose }: { onClose?: () => void }) {
  const [mode, setMode] = useState<AuthMode>("register");
  const [loginDraft, setLoginDraft] = useState<LoginDraft>(() => {
    const draft = readSessionStorage(LOGIN_DRAFT_KEY, EMPTY_LOGIN_DRAFT);
    const remembered =
      typeof window === "undefined"
        ? ""
        : window.sessionStorage.getItem(IDENTIFIER_KEY) ?? "";
    return { ...draft, identifier: draft.identifier || remembered };
  });
  const [registerDraft, setRegisterDraft] = useState<RegisterDraft>(() =>
    readSessionStorage(REGISTER_DRAFT_KEY, EMPTY_REGISTER_DRAFT)
  );
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>(EMPTY_ERRORS);
  const [apiError, setApiError] = useState("");
  const [networkError, setNetworkError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState(() =>
    isEmailValue(loginDraft.identifier) ? loginDraft.identifier.trim() : ""
  );
  const [forgotError, setForgotError] = useState("");
  const [forgotNotice, setForgotNotice] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);

  const firstFieldRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const displayNameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  const titleId = useId();
  const identifierErrorId = useId();
  const emailErrorId = useId();
  const usernameErrorId = useId();
  const displayNameErrorId = useId();
  const passwordErrorId = useId();
  const confirmPasswordErrorId = useId();
  const forgotErrorId = useId();
  const apiErrorId = useId();

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, [mode, forgotOpen]);

  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    writeSessionStorage(LOGIN_DRAFT_KEY, loginDraft);
    writeSessionString(IDENTIFIER_KEY, loginDraft.identifier.trim());
  }, [loginDraft]);

  useEffect(() => {
    writeSessionStorage(REGISTER_DRAFT_KEY, registerDraft);
  }, [registerDraft]);

  useEffect(() => {
    if (!forgotOpen) return;
    if (isEmailValue(loginDraft.identifier)) {
      setForgotEmail(loginDraft.identifier.trim());
    }
  }, [forgotOpen, loginDraft.identifier]);

  const passwordChecks = useMemo(
    () =>
      passwordStrengthChecks(registerDraft.password, {
        email: registerDraft.email,
        username: registerDraft.username,
        displayName: registerDraft.displayName,
      }),
    [registerDraft]
  );

  const passwordStrength = useMemo(
    () =>
      passwordStrengthLabel(registerDraft.password, {
        email: registerDraft.email,
        username: registerDraft.username,
        displayName: registerDraft.displayName,
      }),
    [registerDraft]
  );

  const supportCopy = forgotOpen
    ? "Reset access without leaving the form."
    : mode === "register"
      ? "Create an account to sync runs across devices and join the leaderboard."
      : "Sign in to continue where you left off.";

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
        ? validateIdentifier(loginDraft.identifier)
        : field === "email"
          ? validateEmail(registerDraft.email)
          : field === "username"
            ? validateUsername(registerDraft.username)
            : field === "displayName"
              ? validateDisplayName(registerDraft.displayName)
              : field === "confirmPassword"
                ? validateConfirmPassword(
                    registerDraft.password,
                    registerDraft.confirmPassword
                  )
                : validatePassword(
                    mode === "login" ? loginDraft.password : registerDraft.password,
                    mode
                  );

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
      confirmPassword: confirmPasswordRef,
    };
    refs[field].current?.focus();
  };

  const summaryLines = useMemo(() => {
    if (!submitAttempted) return [];

    const ordered: Array<[AuthField, string]> =
      mode === "login"
        ? [
            ["identifier", "Enter your email or username."],
            ["password", "Enter your password."],
          ]
        : [
            ["email", "Enter a valid email address."],
            ["username", "Choose a valid username."],
            ["displayName", "Add a display name."],
            ["password", "Choose a stronger password."],
            ["confirmPassword", "Confirm your password."],
          ];

    return ordered
      .filter(([field]) => fieldErrors[field])
      .map(([, line]) => line);
  }, [fieldErrors, mode, submitAttempted]);

  const usernameRules = useMemo(() => {
    const trimmed = registerDraft.username.trim();
    return {
      length:
        trimmed.length === 0
          ? "neutral"
          : trimmed.length >= USERNAME_MIN && trimmed.length <= USERNAME_MAX
            ? "success"
            : "error",
      chars:
        trimmed.length === 0
          ? "neutral"
          : /^[a-z0-9_]+$/.test(trimmed)
            ? "success"
            : "error",
      lowercase:
        registerDraft.username.length === 0
          ? "neutral"
          : registerDraft.username === registerDraft.username.toLowerCase()
            ? "success"
            : "error",
    } satisfies Record<string, GuidanceState>;
  }, [registerDraft.username]);

  const emailState: GuidanceState =
    registerDraft.email.length === 0
      ? "neutral"
      : isEmailValue(registerDraft.email)
        ? "success"
        : "error";

  const displayNameState: GuidanceState =
    registerDraft.displayName.trim().length === 0
      ? "neutral"
      : registerDraft.displayName.trim().length <= DISPLAY_NAME_MAX
        ? "success"
        : "error";

  const confirmPasswordState: GuidanceState =
    registerDraft.confirmPassword.length === 0
      ? "neutral"
      : registerDraft.confirmPassword === registerDraft.password
        ? "success"
        : "error";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError("");
    setNetworkError("");
    setSubmitAttempted(true);

    const errors =
      mode === "login"
        ? validateAuthForm(
            {
              identifier: loginDraft.identifier,
              password: loginDraft.password,
            },
            "login"
          )
        : validateAuthForm(
            {
              email: registerDraft.email,
              password: registerDraft.password,
              confirmPassword: registerDraft.confirmPassword,
              username: registerDraft.username,
              displayName: registerDraft.displayName,
            },
            "register"
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
          email: registerDraft.email.trim(),
          username: registerDraft.username,
          displayName: registerDraft.displayName,
          password: registerDraft.password,
        });
        setRegisterDraft((prev) => ({
          ...prev,
          password: "",
          confirmPassword: "",
        }));
      } else {
        await login(loginDraft.identifier, loginDraft.password);
        setLoginDraft((prev) => ({ ...prev, password: "" }));
      }
      await onLogin();
      setFieldErrors(EMPTY_ERRORS);
      setSubmitAttempted(false);
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

  const submitForgotPassword = async () => {
    setForgotError("");
    setForgotNotice("");

    const emailError = validateEmail(forgotEmail);
    if (emailError) {
      setForgotError(emailError);
      return;
    }

    setForgotBusy(true);
    try {
      await requestPasswordReset(forgotEmail);
      setForgotNotice(
        "If that account exists, reset instructions have been sent."
      );
    } catch (err) {
      setForgotError(
        err instanceof Error ? err.message : "Couldn't request password reset."
      );
    } finally {
      setForgotBusy(false);
    }
  };

  const switchMode = (next: AuthMode) => {
    if (next === mode) return;
    setMode(next);
    setFieldErrors(EMPTY_ERRORS);
    setApiError("");
    setNetworkError("");
    setSubmitAttempted(false);
    setForgotOpen(false);
    setForgotError("");
    setForgotNotice("");
  };

  return (
    <div className="auth-page" role="main">
      <header className="auth-page-header rise">
        <div className="wordmark" aria-label="TypeFlow">
          <span
            className="font-display italic"
            style={{ fontSize: 28, color: "var(--text)" }}
          >
            Type
          </span>
          <span
            className="font-display"
            style={{ fontSize: 28, color: "var(--accent)" }}
          >
            Flow
          </span>
          <span className="caret-dot" aria-hidden />
        </div>
      </header>

      <main className="auth-page-body">
        <div className="auth-card pop" aria-labelledby={titleId}>
          <div className="auth-card-stripe" aria-hidden />

          <div className="auth-card-content">
            <div className="auth-mode-seg" role="tablist" aria-label="Account mode">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                className="auth-mode-seg-btn"
                data-active={mode === "login"}
                onClick={() => switchMode("login")}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "register"}
                className="auth-mode-seg-btn"
                data-active={mode === "register"}
                onClick={() => switchMode("register")}
              >
                Create account
              </button>
            </div>

            <div className="auth-card-heading">
              <h1 className="font-display auth-card-title" id={titleId}>
                {mode === "register" ? "Set up TypeFlow" : "Welcome back"}
              </h1>
              <p className="auth-card-sub">
                <TypingSupportText text={supportCopy} />
              </p>
            </div>

            {networkError && (
              <div className="auth-network-error" role="alert">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden
                  style={{ flexShrink: 0, marginTop: 1 }}
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>{networkError}</span>
              </div>
            )}

            {summaryLines.length > 0 && (
              <SummaryError
                title="Please fix the highlighted fields."
                lines={summaryLines}
              />
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
                    value={loginDraft.identifier}
                    onChange={(e) => {
                      setLoginDraft((prev) => ({
                        ...prev,
                        identifier: e.target.value,
                      }));
                      clearFieldError("identifier");
                      setApiError("");
                      setNetworkError("");
                    }}
                    onBlur={() => validateField("identifier")}
                    required
                    autoComplete="username"
                    placeholder="you@example.com or your handle"
                    aria-invalid={!!fieldErrors.identifier}
                    aria-describedby={fieldErrors.identifier ? identifierErrorId : undefined}
                  />
                  {fieldErrors.identifier && (
                    <FieldError
                      id={identifierErrorId}
                      message={fieldErrors.identifier}
                    />
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
                    value={registerDraft.email}
                    onChange={(e) => {
                      setRegisterDraft((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }));
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
                  <ul className="auth-guidance-list">
                    <GuidanceItem state={emailState}>
                      Looks like a real email address
                    </GuidanceItem>
                    <GuidanceItem state="neutral">
                      We&apos;ll use this for sign in and recovery
                    </GuidanceItem>
                  </ul>
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
                      value={registerDraft.username}
                      onChange={(e) => {
                        setRegisterDraft((prev) => ({
                          ...prev,
                          username: normalizeUsernameInput(e.target.value),
                        }));
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
                    <ul className="auth-guidance-list">
                      <GuidanceItem state={usernameRules.length}>
                        {USERNAME_MIN}–{USERNAME_MAX} characters
                      </GuidanceItem>
                      <GuidanceItem state={usernameRules.chars}>
                        Letters, numbers, and underscores only
                      </GuidanceItem>
                      <GuidanceItem state={usernameRules.lowercase}>
                        Lowercase as you type
                      </GuidanceItem>
                    </ul>
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
                      value={registerDraft.displayName}
                      onChange={(e) => {
                        setRegisterDraft((prev) => ({
                          ...prev,
                          displayName: e.target.value,
                        }));
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
                    <ul className="auth-guidance-list">
                      <GuidanceItem state={displayNameState}>
                        This is how you&apos;ll appear on the leaderboard
                      </GuidanceItem>
                    </ul>
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
                    value={mode === "login" ? loginDraft.password : registerDraft.password}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (mode === "login") {
                        setLoginDraft((prev) => ({ ...prev, password: value }));
                      } else {
                        setRegisterDraft((prev) => ({ ...prev, password: value }));
                      }
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
                    aria-describedby={fieldErrors.password ? passwordErrorId : undefined}
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? (
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
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
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
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                {fieldErrors.password && (
                  <FieldError id={passwordErrorId} message={fieldErrors.password} />
                )}

                {mode === "register" && (
                  <div className="auth-password-feedback">
                    <div className="auth-strength-head">
                      <span>Password strength</span>
                      <span className="auth-strength-label" data-strength={passwordStrength}>
                        {strengthDescription(passwordStrength)}
                      </span>
                    </div>
                    <div className="auth-strength-bars" aria-hidden>
                      {[0, 1, 2, 3].map((bar) => (
                        <span
                          key={bar}
                          className="auth-strength-bar"
                          data-active={
                            (passwordStrength === "weak" && bar < 1) ||
                            (passwordStrength === "fair" && bar < 2) ||
                            (passwordStrength === "good" && bar < 3) ||
                            (passwordStrength === "strong" && bar < 4)
                          }
                          data-strength={passwordStrength}
                        />
                      ))}
                    </div>
                    <ul className="auth-guidance-list">
                      <GuidanceItem state={passwordChecks.length ? "success" : registerDraft.password ? "error" : "neutral"}>
                        At least {PASSWORD_MIN} characters
                      </GuidanceItem>
                      <GuidanceItem state={passwordChecks.mixedCase ? "success" : registerDraft.password ? "error" : "neutral"}>
                        Mix uppercase and lowercase letters
                      </GuidanceItem>
                      <GuidanceItem state={passwordChecks.numberOrSymbol ? "success" : registerDraft.password ? "error" : "neutral"}>
                        Add a number or symbol
                      </GuidanceItem>
                      <GuidanceItem state={passwordChecks.noPersonalInfo ? "success" : registerDraft.password ? "error" : "neutral"}>
                        Avoid using your name, email, or username
                      </GuidanceItem>
                    </ul>
                  </div>
                )}
              </div>

              {mode === "register" && (
                <div className="auth-field">
                  <label
                    className="auth-field-label"
                    htmlFor="auth-confirm-password"
                  >
                    Confirm password
                  </label>
                  <input
                    ref={confirmPasswordRef}
                    id="auth-confirm-password"
                    className={`auth-input${fieldErrors.confirmPassword ? " auth-input--invalid" : ""}`}
                    type={showPassword ? "text" : "password"}
                    value={registerDraft.confirmPassword}
                    onChange={(e) => {
                      setRegisterDraft((prev) => ({
                        ...prev,
                        confirmPassword: e.target.value,
                      }));
                      clearFieldError("confirmPassword");
                      setApiError("");
                    }}
                    onBlur={() => validateField("confirmPassword")}
                    required
                    autoComplete="new-password"
                    aria-invalid={!!fieldErrors.confirmPassword}
                    aria-describedby={
                      fieldErrors.confirmPassword ? confirmPasswordErrorId : undefined
                    }
                  />
                  {fieldErrors.confirmPassword && (
                    <FieldError
                      id={confirmPasswordErrorId}
                      message={fieldErrors.confirmPassword}
                    />
                  )}
                  <ul className="auth-guidance-list">
                    <GuidanceItem state={confirmPasswordState}>
                      {confirmPasswordState === "success"
                        ? "Passwords match"
                        : "Repeat the same password"}
                    </GuidanceItem>
                  </ul>
                </div>
              )}

              {mode === "login" && (
                <div className="auth-inline-actions">
                  <button
                    type="button"
                    className="auth-inline-link"
                    onClick={() => {
                      setForgotOpen((prev) => !prev);
                      setForgotError("");
                      setForgotNotice("");
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {mode === "login" && forgotOpen && (
                <div className="auth-forgot panel">
                  <div className="auth-forgot-head">
                    <strong>Reset password</strong>
                    <span className="auth-field-hint">
                      We&apos;ll send reset instructions if the account exists.
                    </span>
                  </div>
                  <div className="auth-forgot-form">
                    <div className="auth-field">
                      <label className="auth-field-label" htmlFor="auth-forgot-email">
                        Account email
                      </label>
                      <input
                        id="auth-forgot-email"
                        className={`auth-input${forgotError ? " auth-input--invalid" : ""}`}
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => {
                          setForgotEmail(e.target.value);
                          setForgotError("");
                          setForgotNotice("");
                        }}
                        autoComplete="email"
                        placeholder="you@example.com"
                        aria-invalid={!!forgotError}
                        aria-describedby={forgotError ? forgotErrorId : undefined}
                      />
                      {forgotError && (
                        <FieldError id={forgotErrorId} message={forgotError} />
                      )}
                      {forgotNotice && (
                        <p className="auth-success" role="status">
                          {forgotNotice}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="ghost auth-forgot-submit"
                      disabled={forgotBusy}
                      onClick={() => void submitForgotPassword()}
                    >
                      {forgotBusy ? "Sending…" : "Send reset link"}
                    </button>
                  </div>
                </div>
              )}

              {apiError && (
                <p className="auth-error" id={apiErrorId} role="alert">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden
                    style={{ flexShrink: 0, marginTop: 1 }}
                  >
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

        {onClose && (
          <button type="button" className="auth-guest-link" onClick={onClose}>
            Continue as guest
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
