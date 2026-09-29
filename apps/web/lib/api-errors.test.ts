import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { getApiErrorKey } from "./api-errors";

const http = (message: string, status = 400) =>
  new ApiError(message, { status, code: "http" });

describe("getApiErrorKey", () => {
  it("maps known API messages", () => {
    expect(getApiErrorKey(http("Invalid credentials", 401))).toBe(
      "invalidCredentials",
    );
    expect(getApiErrorKey(http("Quote has expired"))).toBe("quoteExpired");
    expect(getApiErrorKey(http("Account has active bookings. Complete…", 409))).toBe(
      "activeBookings",
    );
    expect(getApiErrorKey(http("Cannot transition from completed to cancelled"))).toBe(
      "invalidStatusChange",
    );
    expect(getApiErrorKey(http("Booking not found", 404))).toBe("notFound");
  });

  it("covers outages, rate limits and expired sessions", () => {
    expect(
      getApiErrorKey(new ApiError("down", { code: "unavailable" })),
    ).toBe("unavailable");
    expect(getApiErrorKey(http("ThrottlerException", 429))).toBe(
      "tooManyRequests",
    );
    expect(getApiErrorKey(http("Unauthorized", 401))).toBe("sessionExpired");
  });

  it("returns null for unknown errors so callers use their fallback", () => {
    expect(getApiErrorKey(http("something new"))).toBeNull();
    expect(getApiErrorKey(new Error("plain"))).toBeNull();
  });
});
