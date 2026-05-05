import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "./api";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("apiRequest", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
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
});
