// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getUser } from "./auth";
import {
  API_URL,
  attemptSilentRefresh,
  getAccessToken,
  login,
  register,
  setAccessToken,
} from "./api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const userPayload = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "test@example.com",
  username: "testuser",
  display_name: "Test User",
  created_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  setAccessToken(null);
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("register", () => {
  it("stores access token and user on success", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ access_token: "tok-1", token_type: "bearer", user: userPayload })
    );

    const user = await register({
      email: "test@example.com",
      username: "testuser",
      displayName: "Test User",
      password: "hunter2hunter2",
    });
    expect(getAccessToken()).toBe("tok-1");
    expect(user.email).toBe("test@example.com");
    expect(user.username).toBe("testuser");
    expect(getUser()?.displayName).toBe("Test User");
    expect(fetch).toHaveBeenCalledWith(
      `${API_URL}/auth/register`,
      expect.objectContaining({ credentials: "include" })
    );
  });
});

describe("401 retry", () => {
  it("refreshes once then retries the original request", async () => {
    setAccessToken("stale");

    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ detail: "nope" }, 401))
      .mockResolvedValueOnce(jsonResponse({ access_token: "fresh" }))
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: "fresh",
          token_type: "bearer",
          user: userPayload,
        })
      );

    const user = await login("test@example.com", "hunter2hunter2");
    expect(user.email).toBe("test@example.com");
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(getAccessToken()).toBe("fresh");
  });

  it("clears session when refresh fails", async () => {
    setAccessToken("stale");

    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ detail: "nope" }, 401))
      .mockResolvedValueOnce(jsonResponse({ detail: "bad" }, 401));

    await expect(login("test@example.com", "wrong")).rejects.toThrow();
    expect(getAccessToken()).toBeNull();
    expect(getUser()).toBeNull();
  });
});

describe("attemptSilentRefresh", () => {
  it("loads user after successful refresh", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ access_token: "tok" }))
      .mockResolvedValueOnce(jsonResponse(userPayload));

    const ok = await attemptSilentRefresh();
    expect(ok).toBe(true);
    expect(getUser()?.email).toBe("test@example.com");
  });
});
