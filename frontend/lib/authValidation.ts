export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 32;
export const DISPLAY_NAME_MAX = 64;

export type AuthMode = "login" | "register";
export type AuthField =
  | "identifier"
  | "email"
  | "username"
  | "displayName"
  | "password"
  | "confirmPassword";
export type AuthFieldErrors = Partial<Record<AuthField, string>>;
export type PasswordStrength = "weak" | "fair" | "good" | "strong";

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const USERNAME_RE = /^[a-zA-Z0-9_]+$/;

export function validateIdentifier(identifier: string): string | null {
  if (!identifier.trim()) return "Email or username is required.";
  return null;
}

export function normalizeUsernameInput(username: string): string {
  return username.toLowerCase();
}

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Email is required.";
  if (!EMAIL_RE.test(trimmed)) return "Enter a valid email address.";
  return null;
}

export function validateUsername(username: string): string | null {
  const trimmed = username.trim();
  if (!trimmed) return "Username is required.";
  if (trimmed.length < USERNAME_MIN) {
    return `Username must be at least ${USERNAME_MIN} characters.`;
  }
  if (trimmed.length > USERNAME_MAX) {
    return `Username must be at most ${USERNAME_MAX} characters.`;
  }
  if (!USERNAME_RE.test(trimmed)) {
    return "Username may only contain letters, numbers, and underscores.";
  }
  return null;
}

export function validateDisplayName(displayName: string): string | null {
  const trimmed = displayName.trim();
  if (!trimmed) return "Display name is required.";
  if (trimmed.length > DISPLAY_NAME_MAX) {
    return `Display name must be at most ${DISPLAY_NAME_MAX} characters.`;
  }
  return null;
}

export function validatePassword(
  password: string,
  mode: AuthMode
): string | null {
  if (!password) return "Password is required.";
  if (password.length > PASSWORD_MAX) {
    return `Password must be at most ${PASSWORD_MAX} characters.`;
  }
  if (mode === "register" && password.length < PASSWORD_MIN) {
    return `Password must be at least ${PASSWORD_MIN} characters.`;
  }
  return null;
}

export function validateConfirmPassword(
  password: string,
  confirmPassword: string
): string | null {
  if (!confirmPassword) return "Please confirm your password.";
  if (password !== confirmPassword) return "Passwords do not match.";
  return null;
}

export function passwordStrengthChecks(
  password: string,
  context?: {
    email?: string;
    username?: string;
    displayName?: string;
  }
): {
  length: boolean;
  mixedCase: boolean;
  numberOrSymbol: boolean;
  noPersonalInfo: boolean;
} {
  const lowered = password.toLowerCase();
  const contextParts = [
    context?.email?.trim().toLowerCase(),
    context?.username?.trim().toLowerCase(),
    context?.displayName?.trim().toLowerCase(),
  ]
    .filter((part): part is string => !!part)
    .flatMap((part) => part.split(/[^a-z0-9]+/))
    .filter((part) => part.length >= 3);

  return {
    length: password.length >= PASSWORD_MIN,
    mixedCase:
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password),
    numberOrSymbol: /[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password),
    noPersonalInfo:
      contextParts.length === 0 ||
      contextParts.every((part) => !lowered.includes(part)),
  };
}

export function passwordStrengthLabel(
  password: string,
  context?: {
    email?: string;
    username?: string;
    displayName?: string;
  }
): PasswordStrength {
  if (!password) return "weak";

  const checks = passwordStrengthChecks(password, context);
  const passed = Object.values(checks).filter(Boolean).length;

  if (password.length >= 14 && passed === 4) return "strong";
  if (passed >= 3) return "good";
  if (passed >= 2) return "fair";
  return "weak";
}

export function validateAuthForm(
  fields: {
    identifier?: string;
    email?: string;
    password: string;
    confirmPassword?: string;
    username?: string;
    displayName?: string;
  },
  mode: AuthMode
): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  const passwordError = validatePassword(fields.password, mode);
  if (passwordError) errors.password = passwordError;

  if (mode === "login") {
    const identifierError = validateIdentifier(fields.identifier ?? "");
    if (identifierError) errors.identifier = identifierError;
  } else {
    const emailError = validateEmail(fields.email ?? "");
    if (emailError) errors.email = emailError;
    const usernameError = validateUsername(fields.username ?? "");
    const displayNameError = validateDisplayName(fields.displayName ?? "");
    const confirmPasswordError = validateConfirmPassword(
      fields.password,
      fields.confirmPassword ?? ""
    );
    if (usernameError) errors.username = usernameError;
    if (displayNameError) errors.displayName = displayNameError;
    if (confirmPasswordError) errors.confirmPassword = confirmPasswordError;
  }

  return errors;
}

export function firstInvalidField(
  errors: AuthFieldErrors,
  mode: AuthMode
): AuthField | null {
  if (mode === "login") {
    if (errors.identifier) return "identifier";
  } else {
    if (errors.email) return "email";
    if (errors.username) return "username";
    if (errors.displayName) return "displayName";
  }
  if (errors.password) return "password";
  if (errors.confirmPassword) return "confirmPassword";
  return null;
}
