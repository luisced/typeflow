import { clearSession, setSession, type AuthUser } from "./auth";
import type { Mode, RunRecord } from "./types";

export const API_URL =
  process.env.NEXT_PUBLIC_TYPEFLOW_API_URL ?? "http://localhost:8000";

let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;

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

export type ProfileStats = {
  summary: ProfileSummary;
  dailyStats: DailyStat[];
  keyAccuracy: Record<string, number>;
  keyTrends: Record<string, number[]>;
};

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
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        accessToken = null;
        clearSession();
        return false;
      }
      const data = (await res.json()) as { access_token: string };
      accessToken = data.access_token;
      return true;
    } catch {
      accessToken = null;
      clearSession();
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

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: authPaths(path) ? "include" : init.credentials ?? "same-origin",
  });

  if (res.status === 401 && !retried && !path.startsWith("/auth/refresh")) {
    const ok = await refreshAccessToken();
    if (ok) return apiFetch(path, init, true);
    clearSession();
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
  accessToken = data.access_token;
  const u = toAuthUser(data.user);
  setSession(u);
  return u;
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
  accessToken = data.access_token;
  const u = toAuthUser(data.user);
  setSession(u);
  return u;
}

export async function logout(): Promise<void> {
  await apiFetch("/auth/logout", {
    method: "POST",
    credentials: "include",
  }).catch(() => {});
  accessToken = null;
  clearSession();
}

export async function attemptSilentRefresh(): Promise<boolean> {
  const ok = await refreshAccessToken();
  if (!ok) return false;
  try {
    await getMe();
    return true;
  } catch {
    accessToken = null;
    clearSession();
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

export async function fetchRunSummaryPage(
  after: number,
  limit = 500
): Promise<SummaryPage> {
  const res = await apiFetch(`/runs/summary?after=${after}&limit=${limit}`);
  if (!res.ok) throw new Error("Summary fetch failed");
  return res.json() as Promise<SummaryPage>;
}

const SUMMARY_LIMIT = 1000;

export async function fetchProfileStats(): Promise<ProfileStats> {
  const res = await apiFetch("/runs/profile-stats");
  if (!res.ok) throw new Error("Failed to load profile stats");
  return (await res.json()) as ProfileStats;
}

export async function fetchRunSummaries(): Promise<RunSummary[]> {
  const all: RunSummary[] = [];
  let after = 0;

  for (;;) {
    const page = await fetchRunSummaryPage(after);
    all.push(...page.runs);
    if (page.runs.length === 0 || page.nextAfter === after) break;
    after = page.nextAfter;
    if (all.length >= SUMMARY_LIMIT) break;
  }

  return all
    .slice(0, SUMMARY_LIMIT)
    .sort((a, b) => b.date - a.date);
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
  accessToken = null;
  clearSession();
}
