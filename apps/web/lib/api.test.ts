import * as observability from "./observability";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
      message:
        "The service is temporarily unavailable. Please try again shortly.",
      name: "ApiError",
    });
  });

  it("refreshes the access token once on client-side 401 responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: "Unauthorized" }, 401))
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
      .mockResolvedValueOnce(
        jsonResponse({ message: "Request not found" }, 404),
      );
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

    await expect(
      apiRequest("/auth/logout", { method: "POST" }),
    ).resolves.toBeUndefined();
  });

  it("correlates critical failures and reports only safe fields without changing the error", async () => {
    const requestId = "a9bf1a7d-2633-4c76-9dd6-2670b7191666";
    const calls: { url: string; options?: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, options?: RequestInit) => {
      calls.push({ url, options });
      if (url.endsWith("/health/client-error"))
        throw new Error("collector unavailable");
      return new Response("private error containing customer@example.com", {
        status: 503,
        headers: { "X-Request-ID": requestId },
      });
    });

    await expect(
      apiRequest("/bookings/private-id?email=customer@example.com", {
        token: "secret-access-token",
        method: "POST",
        body: JSON.stringify({ message: "private booking information" }),
      }),
    ).rejects.toMatchObject({ code: "unavailable", status: 503, requestId });

    expect(new Headers(calls[0]!.options?.headers).get("X-Request-ID")).toMatch(
      /^[0-9a-f-]{36}$/i,
    );
    expect(calls[1]!.url).toBe("/api/health/client-error");
    expect(calls[1]!.options).toMatchObject({
      method: "POST",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    expect(JSON.parse(calls[1]!.options?.body as string)).toEqual({
      operation: "bookings",
      code: "unavailable",
      status: 503,
      requestId,
    });
    expect(new Headers(calls[1]!.options?.headers).has("Authorization")).toBe(
      false,
    );
  });

  it("reports transport failure with the outbound request ID even when the collector hangs", async () => {
    const calls: RequestInit[] = [];
    vi.stubGlobal("fetch", (url: string, options: RequestInit) => {
      calls.push(options);
      if (url.endsWith("/health/client-error")) return new Promise(() => {});
      return Promise.reject(new Error("private network error"));
    });

    const error = await apiRequest("/quotes/customer-id?token=secret").catch(
      (value) => value,
    );
    if (!(error instanceof ApiError)) throw error;
    expect(error).toMatchObject({ code: "unavailable" });
    const requestId = new Headers(calls[0]!.headers).get("X-Request-ID");
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(error.requestId).toBe(requestId);
    expect(JSON.parse(calls[1]!.body as string)).toEqual({
      operation: "quotes",
      code: "unavailable",
      requestId,
    });
  });

  it("keeps correlation through refresh and retry without reporting an expected 401", async () => {
    const calls: { url: string; options?: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, options?: RequestInit) => {
      calls.push({ url, options });
      if (calls.length === 1)
        return jsonResponse({ message: "Unauthorized" }, 401);
      if (url.endsWith("/auth/refresh"))
        return jsonResponse({
          accessToken: "fresh-access",
          refreshToken: "fresh-refresh",
          user: { id: "user-id" },
        });
      return jsonResponse({ ok: true });
    });
    localStorage.setItem("armut_refresh_token", "refresh-token");

    await expect(apiRequest("/messages/conversations")).resolves.toEqual({
      ok: true,
    });
    const requestId = new Headers(calls[0]!.options?.headers).get(
      "X-Request-ID",
    );
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(
      calls.map((call) =>
        new Headers(call.options?.headers).get("X-Request-ID"),
      ),
    ).toEqual([requestId, requestId, requestId]);
    expect(calls).toHaveLength(3);
  });

  it("ignores untrusted request IDs and leaves expected HTTP failures unreported", async () => {
    const calls: RequestInit[] = [];
    vi.stubGlobal("fetch", async (_url: string, options: RequestInit) => {
      calls.push(options);
      return new Response(JSON.stringify({ message: "Invalid request" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": "private-user-id",
        },
      });
    });
    const error = await apiRequest("/requests", {
      headers: { "X-Request-ID": "customer@example.com" },
    }).catch((value) => value);
    if (!(error instanceof ApiError)) throw error;
    expect(error).toMatchObject({ code: "http", status: 400 });
    expect(error.requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(error.requestId).toBe(
      new Headers(calls[0]!.headers).get("X-Request-ID"),
    );
    expect(calls).toHaveLength(1);
  });

  it("normalizes a failed token retry while preserving the refreshed session", async () => {
    const calls: { url: string; options?: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, options?: RequestInit) => {
      calls.push({ url, options });
      if (url.endsWith("/health/client-error"))
        return new Response(null, { status: 204 });
      if (calls.length === 1)
        return jsonResponse({ message: "Unauthorized" }, 401);
      if (url.endsWith("/auth/refresh"))
        return jsonResponse({
          accessToken: "fresh-access",
          refreshToken: "fresh-refresh",
          user: { id: "user-id" },
        });
      throw new Error("private retry network error");
    });
    localStorage.setItem("armut_refresh_token", "refresh-token");
    await expect(apiRequest("/notifications")).rejects.toMatchObject({
      name: "ApiError",
      code: "unavailable",
    });
    expect(localStorage.getItem("armut_access_token")).toBe("fresh-access");
    expect(localStorage.getItem("armut_refresh_token")).toBe("fresh-refresh");
    const requestId = new Headers(calls[0]!.options?.headers).get(
      "X-Request-ID",
    );
    expect(calls[3]!.url).toBe("/api/health/client-error");
    expect(JSON.parse(calls[3]!.options?.body as string)).toEqual({
      operation: "notifications",
      code: "unavailable",
      requestId,
    });
  });

  it.each(["network", "server"])(
    "reports %s refresh failure while preserving the session",
    async (failure) => {
      const calls: { url: string; options?: RequestInit }[] = [];
      vi.stubGlobal("fetch", async (url: string, options?: RequestInit) => {
        calls.push({ url, options });
        if (url.endsWith("/health/client-error"))
          return new Response(null, { status: 204 });
        if (url.endsWith("/auth/refresh")) {
          if (failure === "network") throw new Error("private refresh error");
          return jsonResponse({ message: "private backend error" }, 503);
        }
        return jsonResponse({ message: "Unauthorized" }, 401);
      });
      localStorage.setItem("armut_refresh_token", "refresh-token");
      await expect(apiRequest("/requests")).rejects.toMatchObject({
        code: "unavailable",
        ...(failure === "server" ? { status: 503 } : {}),
      });
      expect(localStorage.getItem("armut_refresh_token")).toBe("refresh-token");
      expect(JSON.parse(calls[2]!.options?.body as string)).toEqual({
        operation: "auth",
        code: "unavailable",
        ...(failure === "server" ? { status: 503 } : {}),
        requestId: new Headers(calls[0]!.options?.headers).get("X-Request-ID"),
      });
    },
  );

  it("keeps requests working when randomUUID is unavailable on an HTTP browser origin", async () => {
    const getRandomValues = crypto.getRandomValues.bind(crypto);
    vi.stubGlobal("crypto", { getRandomValues });
    let headers: Headers | undefined;
    vi.stubGlobal("fetch", async (_url: string, options: RequestInit) => {
      headers = new Headers(options.headers);
      return jsonResponse({ ok: true });
    });
    await expect(apiRequest("/requests")).resolves.toEqual({ ok: true });
    expect(headers?.get("X-Request-ID")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

describe("refresh/retry cancellation budget", () => {
  const fresh = {
    accessToken: "fresh-access",
    refreshToken: "fresh-refresh",
    user: { id: "user" },
  };
  let calls: { url: string; init: RequestInit }[];
  let caller: AbortController;
  let report: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("NEXT_PUBLIC_API_TIMEOUT_MS", "1000");
    localStorage.clear();
    localStorage.setItem("armut_refresh_token", "refresh");
    localStorage.setItem("armut_access_token", "access");
    localStorage.setItem("armut_user", "user");
    calls = [];
    caller = new AbortController();
    report = vi
      .spyOn(observability, "reportClientError")
      .mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function mockFlow(waitStage?: number) {
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
      calls.push({ url, init });
      const stage = calls.length;
      if (stage === waitStage) {
        return new Promise<Response>((_resolve, reject) => {
          init.signal!.addEventListener(
            "abort",
            () => reject(init.signal!.reason),
            { once: true },
          );
        });
      }
      return Promise.resolve(
        stage === 1
          ? jsonResponse({ message: "Unauthorized" }, 401)
          : stage === 2
            ? jsonResponse(fresh)
            : jsonResponse({ ok: true }),
      );
    });
  }

  it("uses the same signal, ID, FormData and cache on a successful direct retry", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.test");
    mockFlow();
    const body = new FormData();
    body.append("file", "value");
    await expect(
      apiRequest("/uploads/request", {
        method: "POST",
        body,
        direct: true,
        cache: "no-store",
        signal: caller.signal,
      }),
    ).resolves.toEqual({ ok: true });
    expect(calls).toHaveLength(3);
    expect(calls.map((c) => c.init.signal)).toEqual([
      calls[0]!.init.signal,
      calls[0]!.init.signal,
      calls[0]!.init.signal,
    ]);
    const ids = calls.map((c) =>
      new Headers(c.init.headers).get("X-Request-ID"),
    );
    expect(ids[0]).toMatch(/^[a-f0-9-]{36}$/i);
    expect(ids).toEqual([ids[0], ids[0], ids[0]]);
    for (const index of [0, 2]) {
      expect(calls[index]!.url).toBe(
        "https://api.example.test/api/uploads/request",
      );
      expect(calls[index]!.init.body).toBe(body);
      expect(calls[index]!.init.cache).toBe("no-store");
      expect(new Headers(calls[index]!.init.headers).has("Content-Type")).toBe(
        false,
      );
    }
    expect(report).not.toHaveBeenCalled();
    // Response body parsing queues zero-delay runtime jobs; flush those only.
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([2, 3])(
    "times out during stage %s with the original total budget",
    async (stage) => {
      vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
        calls.push({ url, init });
        const current = calls.length;
        if (current < stage)
          return new Promise<Response>((resolve) =>
            setTimeout(
              () =>
                resolve(
                  current === 1 ? jsonResponse({}, 401) : jsonResponse(fresh),
                ),
              300,
            ),
          );
        return new Promise<Response>((_resolve, reject) =>
          init.signal!.addEventListener(
            "abort",
            () => reject(init.signal!.reason),
            { once: true },
          ),
        );
      });
      const result = apiRequest("/requests", { signal: caller.signal }).catch(
        (error) => error,
      );
      await vi.advanceTimersByTimeAsync(999);
      expect(calls).toHaveLength(stage);
      expect(calls[stage - 1]!.init.signal!.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(await result).toMatchObject({
        name: "ApiError",
        code: "unavailable",
      });
      expect(calls[stage - 1]!.init.signal!.aborted).toBe(true);
      expect(calls).toHaveLength(stage);
      expect(localStorage.getItem("armut_refresh_token")).toBe(
        stage === 2 ? "refresh" : "fresh-refresh",
      );
      expect(report).toHaveBeenCalledTimes(1);
      // Response body parsing queues zero-delay runtime jobs; flush those only.
      await vi.advanceTimersByTimeAsync(0);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it.each([0, 1, 2, 3])(
    "honors caller abort at stage %s without outage telemetry",
    async (stage) => {
      const remove = vi.spyOn(caller.signal, "removeEventListener");
      mockFlow(stage);
      if (stage === 0) caller.abort(new Error("private caller reason"));
      const result = apiRequest("/requests", { signal: caller.signal }).catch(
        (error) => error,
      );
      await vi.advanceTimersByTimeAsync(0);
      if (stage > 0) caller.abort(new Error("private caller reason"));
      expect(await result).toMatchObject({
        name: "ApiError",
        code: "unavailable",
      });
      expect(calls).toHaveLength(stage);
      if (stage > 0) expect(calls[stage - 1]!.init.signal!.aborted).toBe(true);
      expect(report).not.toHaveBeenCalled();
      expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
      // Response body parsing queues zero-delay runtime jobs; flush those only.
      await vi.advanceTimersByTimeAsync(0);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it.each([400, 401, 403, 429, 500, 503])(
    "handles refresh %s session policy without retry",
    async (status) => {
      vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return Promise.resolve(
          jsonResponse(
            { message: "Rejected" },
            calls.length === 1 ? 401 : status,
          ),
        );
      });
      const result = await apiRequest("/requests").catch((error) => error);
      expect(result).toBeInstanceOf(ApiError);
      if (!(result instanceof ApiError)) throw result;
      expect(calls).toHaveLength(2);
      const rejected = [400, 401, 403].includes(status);
      for (const key of [
        "armut_access_token",
        "armut_refresh_token",
        "armut_user",
      ]) {
        expect(localStorage.getItem(key) === null).toBe(rejected);
      }
      expect(result.status).toBe(rejected ? 401 : status);
      // Response body parsing queues zero-delay runtime jobs; flush those only.
      await vi.advanceTimersByTimeAsync(0);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("never performs a second refresh for retry 401", async () => {
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve(
        calls.length === 2 ? jsonResponse(fresh) : jsonResponse({}, 401),
      );
    });
    await expect(apiRequest("/requests")).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
    });
    expect(calls).toHaveLength(3);
    // Response body parsing queues zero-delay runtime jobs; flush those only.
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("normalizes an error-body transport failure instead of exposing the earlier HTTP status", async () => {
    const response = jsonResponse({}, 401);
    vi.spyOn(response, "json").mockRejectedValue(
      new TypeError("private stream failure"),
    );
    vi.spyOn(response, "text").mockRejectedValue(
      new TypeError("private stream failure"),
    );
    localStorage.removeItem("armut_refresh_token");
    vi.stubGlobal("fetch", async () => response);
    const error = await apiRequest("/requests").catch((value) => value);
    expect(error).toMatchObject({ name: "ApiError", code: "unavailable" });
    if (!(error instanceof ApiError)) throw error;
    expect(error.status).toBeUndefined();
  });

  it.each(["refresh-json", "retry-json", "retry-text", "error-text"])(
    "aborts during %s parsing and cleans up",
    async (stage) => {
      const remove = vi.spyOn(caller.signal, "removeEventListener");
      let parsing = false;
      vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        const n = calls.length;
        if (n === 1 && stage !== "error-text") return jsonResponse({}, 401);
        const response =
          n === 2
            ? jsonResponse(fresh)
            : stage === "retry-text"
              ? new Response("result")
              : jsonResponse({}, stage === "error-text" ? 400 : 200);
        if (
          (stage === "refresh-json" && n === 2) ||
          (stage.startsWith("retry") && n === 3) ||
          stage === "error-text"
        ) {
          const read = () => {
            parsing = true;
            if (init.signal!.aborted)
              return Promise.reject(init.signal!.reason);
            return new Promise<never>((_resolve, reject) =>
              init.signal!.addEventListener(
                "abort",
                () => reject(init.signal!.reason),
                { once: true },
              ),
            );
          };
          vi.spyOn(
            response,
            stage.endsWith("json") ? "json" : "text",
          ).mockImplementation(read);
          if (stage === "error-text")
            vi.spyOn(response, "json").mockImplementation(read);
        }
        return response;
      });
      const result = apiRequest("/requests", { signal: caller.signal }).catch(
        (error) => error,
      );
      await vi.advanceTimersByTimeAsync(0);
      expect(parsing).toBe(true);
      caller.abort();
      expect(await result).toMatchObject({
        name: "ApiError",
        code: "unavailable",
      });
      expect(calls).toHaveLength(
        stage === "refresh-json" ? 2 : stage === "error-text" ? 1 : 3,
      );
      if (stage === "refresh-json")
        expect(localStorage.getItem("armut_access_token")).toBe("access");
      expect(report).not.toHaveBeenCalled();
      expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
      await vi.advanceTimersByTimeAsync(0);
      expect(vi.getTimerCount()).toBe(0);
    },
  );
});
