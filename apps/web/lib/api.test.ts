import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest } from "./api";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("apiRequest", () => {
  let now = Date.now();
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    now += 60_001;
    vi.spyOn(Date, "now").mockReturnValue(now);
  });

  it("wraps transport failures as unavailable API errors", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/categories")).rejects.toMatchObject({
      code: "unavailable",
      message: "The service is temporarily unavailable. Please try again shortly.",
      name: "ApiError",
    });
  });

  it("refreshes the access token once on client-side 401 responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ message: "Unauthorized" }, 401),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          accessToken: "fresh-access",
          refreshToken: "fresh-refresh",
          user: {
            id: "user-1",
            email: "fresh@example.com",
            firstName: "Fresh",
            lastName: "User",
            userType: "customer",
            createdAt: new Date().toISOString(),
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    localStorage.setItem("armut_refresh_token", "refresh-token");

    await expect(apiRequest<{ ok: boolean }>("/requests")).resolves.toEqual({
      ok: true,
    });

    expect(localStorage.getItem("armut_access_token")).toBe("fresh-access");
    expect(localStorage.getItem("armut_refresh_token")).toBe("fresh-refresh");

    const retryHeaders = fetchMock.mock.calls[2]?.[1]?.headers as Headers;
    expect(retryHeaders.get("Authorization")).toBe("Bearer fresh-access");
  });

  it("surfaces JSON API messages for http errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: "Request not found" }, 404));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/requests/missing")).rejects.toMatchObject({
      code: "http",
      status: 404,
      message: "Request not found",
    });
  });

  it("returns undefined for 204 responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/auth/logout", { method: "POST" })).resolves.toBeUndefined();
  });

  it("correlates critical failures and reports only safe fields without changing the error", async () => {
    const requestId = "a9bf1a7d-2633-4c76-9dd6-2670b7191666";
    const calls: { url: string; options?: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, options?: RequestInit) => {
      calls.push({ url, options });
      if (url.endsWith("/health/client-error")) throw new Error("collector unavailable");
      return new Response("private error containing customer@example.com", {
        status: 503,
        headers: { "X-Request-ID": requestId },
      });
    });

    await expect(apiRequest("/bookings/private-id?email=customer@example.com", {
      token: "secret-access-token",
      method: "POST",
      body: JSON.stringify({ message: "private booking information" }),
    })).rejects.toMatchObject({ code: "unavailable", status: 503, requestId });

    expect(new Headers(calls[0]!.options?.headers).get("X-Request-ID")).toMatch(
      /^[0-9a-f-]{36}$/i,
    );
    expect(calls[1]!.url).toBe("/api/health/client-error");
    expect(calls[1]!.options).toMatchObject({
      method: "POST", credentials: "omit", referrerPolicy: "no-referrer",
    });
    expect(JSON.parse(calls[1]!.options?.body as string)).toEqual({
      operation: "bookings", code: "unavailable", status: 503, requestId,
    });
    expect(new Headers(calls[1]!.options?.headers).has("Authorization")).toBe(false);
  });

  it("reports transport failure with the outbound request ID even when the collector hangs", async () => {
    const calls: RequestInit[] = [];
    vi.stubGlobal("fetch", (url: string, options: RequestInit) => {
      calls.push(options);
      if (url.endsWith("/health/client-error")) return new Promise(() => {});
      return Promise.reject(new Error("private network error"));
    });

    const error = await apiRequest("/quotes/customer-id?token=secret").catch((value) => value);
    if (!(error instanceof ApiError)) throw error;
    expect(error).toMatchObject({ code: "unavailable" });
    const requestId = new Headers(calls[0]!.headers).get("X-Request-ID");
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(error.requestId).toBe(requestId);
    expect(JSON.parse(calls[1]!.body as string)).toEqual({
      operation: "quotes", code: "unavailable", requestId,
    });
  });

  it("keeps correlation through refresh and retry without reporting an expected 401", async () => {
    const calls: { url: string; options?: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, options?: RequestInit) => {
      calls.push({ url, options });
      if (calls.length === 1) return jsonResponse({ message: "Unauthorized" }, 401);
      if (url.endsWith("/auth/refresh")) return jsonResponse({
        accessToken: "fresh-access", refreshToken: "fresh-refresh", user: { id: "user-id" },
      });
      return jsonResponse({ ok: true });
    });
    localStorage.setItem("armut_refresh_token", "refresh-token");

    await expect(apiRequest("/messages/conversations")).resolves.toEqual({ ok: true });
    const requestId = new Headers(calls[0]!.options?.headers).get("X-Request-ID");
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(calls.map((call) => new Headers(call.options?.headers).get("X-Request-ID")))
      .toEqual([requestId, requestId, requestId]);
    expect(calls).toHaveLength(3);
  });

  it("ignores untrusted request IDs and leaves expected HTTP failures unreported", async () => {
    const calls: RequestInit[] = [];
    vi.stubGlobal("fetch", async (_url: string, options: RequestInit) => {
      calls.push(options);
      return new Response(JSON.stringify({ message: "Invalid request" }), {
        status: 400, headers: { "Content-Type": "application/json", "X-Request-ID": "private-user-id" },
      });
    });
    const error = await apiRequest("/requests", {
      headers: { "X-Request-ID": "customer@example.com" },
    }).catch((value) => value);
    if (!(error instanceof ApiError)) throw error;
    expect(error).toMatchObject({ code: "http", status: 400 });
    expect(error.requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(error.requestId).toBe(new Headers(calls[0]!.headers).get("X-Request-ID"));
    expect(calls).toHaveLength(1);
  });

  it("reports a failed token retry without changing the existing session or 401 outcome", async () => {
    const calls: { url: string; options?: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, options?: RequestInit) => {
      calls.push({ url, options });
      if (url.endsWith("/health/client-error")) return new Response(null, { status: 204 });
      if (calls.length === 1) return jsonResponse({ message: "Unauthorized" }, 401);
      if (url.endsWith("/auth/refresh")) return jsonResponse({
        accessToken: "fresh-access", refreshToken: "fresh-refresh", user: { id: "user-id" },
      });
      throw new Error("private retry network error");
    });
    localStorage.setItem("armut_refresh_token", "refresh-token");
    await expect(apiRequest("/notifications")).rejects.toMatchObject({ code: "http", status: 401 });
    expect(localStorage.getItem("armut_access_token")).toBe("fresh-access");
    expect(localStorage.getItem("armut_refresh_token")).toBe("fresh-refresh");
    const requestId = new Headers(calls[0]!.options?.headers).get("X-Request-ID");
    expect(calls[3]!.url).toBe("/api/health/client-error");
    expect(JSON.parse(calls[3]!.options?.body as string)).toEqual({
      operation: "notifications", code: "unavailable", requestId,
    });
  });

  it.each(["network", "server"])("reports %s refresh failure while preserving the session and original error", async (failure) => {
    const calls: { url: string; options?: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, options?: RequestInit) => {
      calls.push({ url, options });
      if (url.endsWith("/health/client-error")) return new Response(null, { status: 204 });
      if (url.endsWith("/auth/refresh")) {
        if (failure === "network") throw new Error("private refresh error");
        return jsonResponse({ message: "private backend error" }, 503);
      }
      return jsonResponse({ message: "Unauthorized" }, 401);
    });
    localStorage.setItem("armut_refresh_token", "refresh-token");
    await expect(apiRequest("/requests")).rejects.toMatchObject({ code: "http", status: 401 });
    expect(localStorage.getItem("armut_refresh_token")).toBe("refresh-token");
    expect(JSON.parse(calls[2]!.options?.body as string)).toEqual({
      operation: "auth", code: "unavailable",
      ...(failure === "server" ? { status: 503 } : {}),
      requestId: new Headers(calls[0]!.options?.headers).get("X-Request-ID"),
    });
  });

  it("keeps requests working when randomUUID is unavailable on an HTTP browser origin", async () => {
    const getRandomValues = crypto.getRandomValues.bind(crypto);
    vi.stubGlobal("crypto", { getRandomValues });
    let headers: Headers | undefined;
    vi.stubGlobal("fetch", async (_url: string, options: RequestInit) => {
      headers = new Headers(options.headers);
      return jsonResponse({ ok: true });
    });
    await expect(apiRequest("/requests")).resolves.toEqual({ ok: true });
    expect(headers?.get("X-Request-ID")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
