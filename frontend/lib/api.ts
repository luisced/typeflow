import { clearSession, setSession, type AuthUser } from "./auth";
import { clearKeyboards } from "./keyboards";
import type { Keyboard, KeyboardLayout, Mode, RunRecord } from "./types";

export const API_URL =
  process.env.NEXT_PUBLIC_TYPEFLOW_API_URL ?? "http://localhost:8000";

export class NetworkError extends Error {
  constructor() {
    super(
      `Cannot reach the API at ${API_URL}. ` +
        `If self-hosting, verify NEXT_PUBLIC_TYPEFLOW_API_URL and TYPEFLOW_CORS_ORIGINS are configured correctly.`
    );
    this.name = "NetworkError";
  }
}

let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;
let authStateVersion = 0;

type ApiUser = {
  id: string;
  email: string;
  username: string;
  display_name: string;
  created_at: string;
};

type TokenResponse = {
  access_token: string;
  token_type: string;
  user: ApiUser;
};

type SyncPage = {
  runs: (RunRecord & { seq: number })[];
  nextAfter: number;
  clearEpoch: number;
};

type BatchResult = { accepted: string[]; skipped: string[] };

export type RunSummary = {
  id: string;
  mode: Mode;
  value: number;
  wpm: number;
  accuracy: number;
  consistency: number;
  durationSec: number;
  date: number;
  keyboardId?: string;
  keyboardName?: string;
  keyboardLayout?: KeyboardLayout;
  flagsKey?: string;
};

export type RunFilters = {
  keyboardId?: string;
  layout?: KeyboardLayout;
  flagsKey?: string;
  mode?: Mode;
};

export type ProfileSummary = {
  bestWpm: number;
  avgWpm: number;
  avgAccuracy: number;
  totalRuns: number;
  totalTimeSec: number;
};

export type DailyStat = {
  date: string;
  avgWpm: number;
  runCount: number;
};

export type WpmHistoryPoint = {
  finishedAt: string;
  wpm: number;
};

export type ProfileStats = {
  summary: ProfileSummary;
  dailyStats: DailyStat[];
  wpmHistory: WpmHistoryPoint[];
  keyAccuracy: Record<string, number>;
  keyTrends: Record<string, number[]>;
};

export type LeaderboardEntry = {
  rank: number;
  username: string;
  displayName: string;
  wpm: number;
  accuracy: number;
  score: number;
  date: number;
};

export type LeaderboardResponse = {
  entries: LeaderboardEntry[];
  yourEntry: LeaderboardEntry | null;
};

export type LeaderboardTimeframe = "all_time" | "monthly";

export type LeaderboardBucket = {
  mode: "time" | "words";
  value: number;
  label: string;
};

export const LEADERBOARD_BUCKETS: LeaderboardBucket[] = [
  { mode: "time", value: 15, label: "15s" },
  { mode: "time", value: 30, label: "30s" },
  { mode: "time", value: 60, label: "60s" },
  { mode: "words", value: 25, label: "25w" },
];

type SummaryPage = {
  runs: RunSummary[];
  nextAfter: number;
  clearEpoch: number;
};

function toAuthUser(raw: ApiUser): AuthUser {
  return {
    id: raw.id,
    email: raw.email,
    username: raw.username,
    displayName: raw.display_name,
    createdAt: raw.created_at,
  };
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  authStateVersion += 1;
}

function commitAuthenticatedUser(token: string, user: AuthUser): AuthUser {
  accessToken = token;
  authStateVersion += 1;
  setSession(user);
  return user;
}

function clearAuthState(): void {
  accessToken = null;
  authStateVersion += 1;
  clearSession();
}

function authPaths(path: string): boolean {
  return path.startsWith("/auth");
}

function parseApiError(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (typeof first === "object" && first && "msg" in first) {
      const msg = (first as { msg?: unknown }).msg;
      if (typeof msg === "string") return msg;
    }
  }
  return fallback;
}

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const requestVersion = authStateVersion;
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        if (authStateVersion === requestVersion) clearAuthState();
        return false;
      }
      const data = (await res.json()) as { access_token: string };
      if (authStateVersion !== requestVersion) return false;
      accessToken = data.access_token;
      authStateVersion += 1;
      return true;
    } catch {
      if (authStateVersion === requestVersion) clearAuthState();
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
  retried = false
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      credentials: authPaths(path) ? "include" : init.credentials ?? "same-origin",
    });
  } catch (err) {
    if (err instanceof TypeError) throw new NetworkError();
    throw err;
  }

  if (res.status === 401 && !retried && !path.startsWith("/auth/refresh")) {
    const ok = await refreshAccessToken();
    if (ok) return apiFetch(path, init, true);
  }

  return res;
}

export type RegisterInput = {
  email: string;
  username: string;
  displayName: string;
  password: string;
};

export async function register(input: RegisterInput): Promise<AuthUser> {
  const res = await apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: input.email.trim(),
      username: input.username.trim().toLowerCase(),
      display_name: input.displayName.trim(),
      password: input.password,
    }),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(parseApiError(err, "Registration failed"));
  }
  const data = (await res.json()) as TokenResponse;
  const u = toAuthUser(data.user);
  return commitAuthenticatedUser(data.access_token, u);
}

export async function login(identifier: string, password: string): Promise<AuthUser> {
  const res = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier: identifier.trim(), password }),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(parseApiError(err, "Invalid credentials"));
  }
  const data = (await res.json()) as TokenResponse;
  const u = toAuthUser(data.user);
  return commitAuthenticatedUser(data.access_token, u);
}

export async function logout(): Promise<void> {
  await apiFetch("/auth/logout", {
    method: "POST",
    credentials: "include",
  }).catch(() => {});
  clearAuthState();
  clearKeyboards();
}

export async function requestPasswordReset(email: string): Promise<void> {
  const res = await apiFetch("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email: email.trim() }),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(parseApiError(err, "Couldn't request password reset"));
  }
}

export async function attemptSilentRefresh(): Promise<boolean> {
  const ok = await refreshAccessToken();
  if (!ok) return false;
  const refreshVersion = authStateVersion;
  try {
    await getMe();
    return true;
  } catch {
    if (authStateVersion === refreshVersion) clearAuthState();
    return false;
  }
}

export async function getMe(): Promise<AuthUser> {
  const res = await apiFetch("/me");
  if (!res.ok) throw new Error("Not authenticated");
  const data = (await res.json()) as ApiUser;
  const u = toAuthUser(data);
  setSession(u);
  return u;
}

export async function pushRuns(runs: RunRecord[]): Promise<BatchResult> {
  const res = await apiFetch("/runs/batch", {
    method: "POST",
    body: JSON.stringify({ runs }),
  });
  if (!res.ok) throw new Error("Push failed");
  return res.json() as Promise<BatchResult>;
}

export async function pullRuns(
  after: number,
  limit = 500
): Promise<SyncPage> {
  const res = await apiFetch(`/runs?after=${after}&limit=${limit}`);
  if (!res.ok) throw new Error("Pull failed");
  return res.json() as Promise<SyncPage>;
}

function filtersQuery(filters?: RunFilters): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.keyboardId) params.set("keyboardId", filters.keyboardId);
  if (filters.layout) params.set("layout", filters.layout);
  if (filters.flagsKey) params.set("flagsKey", filters.flagsKey);
  if (filters.mode) params.set("mode", filters.mode);
  const qs = params.toString();
  return qs ? `&${qs}` : "";
}

export async function fetchRunSummaryPage(
  after: number,
  limit = 500,
  filters?: RunFilters
): Promise<SummaryPage> {
  const res = await apiFetch(
    `/runs/summary?after=${after}&limit=${limit}${filtersQuery(filters)}`
  );
  if (!res.ok) throw new Error("Summary fetch failed");
  return res.json() as Promise<SummaryPage>;
}

const SUMMARY_LIMIT = 1000;

export async function fetchProfileStats(
  filters?: RunFilters
): Promise<ProfileStats> {
  const params = new URLSearchParams();
  if (filters?.keyboardId) params.set("keyboardId", filters.keyboardId);
  if (filters?.layout) params.set("layout", filters.layout);
  if (filters?.flagsKey) params.set("flagsKey", filters.flagsKey);
  if (filters?.mode) params.set("mode", filters.mode);
  const qs = params.toString();
  const res = await apiFetch(`/runs/profile-stats${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to load profile stats");
  return (await res.json()) as ProfileStats;
}

export async function fetchRunSummaries(
  filters?: RunFilters
): Promise<RunSummary[]> {
  const all: RunSummary[] = [];
  let after = 0;

  for (;;) {
    const page = await fetchRunSummaryPage(after, 500, filters);
    all.push(...page.runs);
    if (page.runs.length === 0 || page.nextAfter === after) break;
    after = page.nextAfter;
    if (all.length >= SUMMARY_LIMIT) break;
  }

  return all
    .slice(0, SUMMARY_LIMIT)
    .sort((a, b) => b.date - a.date);
}

type ApiKeyboard = {
  id: string;
  name: string;
  layout: KeyboardLayout;
  isActive: boolean;
  createdAt: string;
};

function toKeyboard(raw: ApiKeyboard): Keyboard {
  return {
    id: raw.id,
    name: raw.name,
    layout: raw.layout,
    isActive: raw.isActive,
    createdAt: raw.createdAt,
  };
}

export async function fetchKeyboards(): Promise<Keyboard[]> {
  const res = await apiFetch("/me/keyboards");
  if (!res.ok) throw new Error("Failed to load keyboards");
  const data = (await res.json()) as ApiKeyboard[];
  return data.map(toKeyboard);
}

export async function createKeyboard(
  name: string,
  layout: KeyboardLayout
): Promise<Keyboard> {
  const res = await apiFetch("/me/keyboards", {
    method: "POST",
    body: JSON.stringify({ name, layout }),
  });
  if (!res.ok) throw new Error("Failed to create keyboard");
  return toKeyboard((await res.json()) as ApiKeyboard);
}

export async function updateKeyboard(
  id: string,
  patch: { name?: string; layout?: KeyboardLayout; isActive?: boolean }
): Promise<Keyboard> {
  const res = await apiFetch(`/me/keyboards/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to update keyboard");
  return toKeyboard((await res.json()) as ApiKeyboard);
}

export async function deleteKeyboard(id: string): Promise<void> {
  const res = await apiFetch(`/me/keyboards/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete keyboard");
}

export async function fetchLeaderboard(
  mode: "time" | "words",
  value: number,
  timeframe: LeaderboardTimeframe = "all_time"
): Promise<LeaderboardResponse> {
  const params = new URLSearchParams({
    mode,
    value: String(value),
    timeframe,
  });
  const res = await apiFetch(`/runs/leaderboard?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to load leaderboard");
  return (await res.json()) as LeaderboardResponse;
}

export async function fetchRunById(id: string): Promise<RunRecord> {
  const res = await apiFetch(`/runs/${encodeURIComponent(id)}`);
  if (res.status === 404) throw new Error("Run not found");
  if (!res.ok) throw new Error("Fetch failed");
  const run = (await res.json()) as RunRecord & { seq?: number };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- strip server seq
  const { seq, ...rest } = run;
  return rest;
}

export async function clearServerHistory(): Promise<void> {
  const res = await apiFetch("/runs", { method: "DELETE" });
  if (!res.ok) throw new Error("Clear failed");
}

export async function deleteAccount(): Promise<void> {
  const res = await apiFetch("/me", { method: "DELETE" });
  if (!res.ok) throw new Error("Delete failed");
  clearAuthState();
  clearKeyboards();
}
