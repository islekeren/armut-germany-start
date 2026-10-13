import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("privacy-safe frontend error reporting", () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.useRealTimers(); });

  it("constructs an allowlisted payload and omits identifiers and untrusted correlation", async () => {
    const { reportClientError } = await import("./observability");
    const requests: RequestInit[] = [];
    vi.stubGlobal("fetch", async (_url: string, options: RequestInit) => {
      requests.push(options);
      return new Response(null, { status: 204 });
    });
    reportClientError({ operation: "uploads", code: "http", status: 502,
      requestId: "customer@example.com", token: "private", stack: "private" } as never);
    expect(JSON.parse(requests[0]!.body as string)).toEqual({
      operation: "uploads", code: "http", status: 502,
    });
    expect(requests[0]).toMatchObject({ credentials: "omit", referrerPolicy: "no-referrer" });
    expect(new Headers(requests[0]!.headers).get("Content-Type")).toBe("application/json");
    reportClientError({ operation: "private-user-id", code: "private-error", status: 900 } as never);
    expect(JSON.parse(requests[1]!.body as string)).toEqual({ operation: "unknown", code: "render" });
  });

  it("deduplicates repeated failures and caps browser reports at ten per minute", async () => {
    vi.useFakeTimers();
    const { reportClientError } = await import("./observability");
    const bodies: string[] = [];
    vi.stubGlobal("fetch", async (_url: string, options: RequestInit) => {
      bodies.push(options.body as string);
      return new Response(null, { status: 204 });
    });
    reportClientError({ operation: "requests", code: "unavailable", status: 500 });
    reportClientError({ operation: "requests", code: "unavailable", status: 500,
      requestId: "a9bf1a7d-2633-4c76-9dd6-2670b7191666" });
    expect(bodies).toHaveLength(1);
    for (let status = 501; status < 515; status++) {
      reportClientError({ operation: "requests", code: "unavailable", status });
    }
    expect(bodies).toHaveLength(10);
    await vi.advanceTimersByTimeAsync(60_000);
    reportClientError({ operation: "requests", code: "unavailable", status: 500 });
    expect(bodies).toHaveLength(11);
  });

  it("bounds collector requests and absorbs synchronous and asynchronous collector failures", async () => {
    vi.useFakeTimers();
    const { reportClientError } = await import("./observability");
    let collectorSignal: AbortSignal | null | undefined;
    vi.stubGlobal("fetch", (_url: string, options: RequestInit) => {
      collectorSignal = options.signal;
      return new Promise((_resolve, reject) => options.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
    });
    expect(() => reportClientError({ operation: "auth", code: "unavailable" })).not.toThrow();
    expect(collectorSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(2000);
    expect(collectorSignal?.aborted).toBe(true);
    vi.stubGlobal("fetch", () => { throw new Error("private collector error"); });
    expect(() => reportClientError({ operation: "bookings", code: "render" })).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("writes safe structured runtime logs for SSR without contacting the collector", async () => {
    const { reportClientError } = await import("./observability");
    vi.stubGlobal("window", undefined);
    const messages: string[] = [];
    vi.spyOn(console, "error").mockImplementation((message: string) => { messages.push(message); });
    vi.stubGlobal("fetch", () => { throw new Error("SSR must not contact collector"); });
    reportClientError({ operation: "providers", code: "unavailable", status: 503,
      requestId: "a9bf1a7d-2633-4c76-9dd6-2670b7191666", message: "private" } as never);
    expect(messages.map((message) => JSON.parse(message))).toEqual([{
      event: "frontend_error", runtime: "server", operation: "providers", code: "unavailable",
      status: 503, requestId: "a9bf1a7d-2633-4c76-9dd6-2670b7191666",
    }]);
  });

  it("maps endpoint groups to fixed operation names without including URL or query content", async () => {
    const { getErrorOperation } = await import("./observability");
    expect(getErrorOperation("/bookings/customer-id?email=private")).toBe("bookings");
    expect(getErrorOperation("/providers/me/bookings")).toBe("providers");
    expect(getErrorOperation("/users/private-id")).toBe("unknown");
    expect(getErrorOperation("/requests-private-id")).toBe("unknown");
    expect(getErrorOperation("https://private.example/auth")).toBe("unknown");
  });
});
