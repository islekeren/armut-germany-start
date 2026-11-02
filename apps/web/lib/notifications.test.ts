import { describe, expect, it } from "vitest";
import { getNotificationHref, getNotificationTemplate } from "./notifications";

describe("getNotificationTemplate", () => {
  it("uses metadata when present", () => {
    expect(
      getNotificationTemplate({
        type: "booking_cancelled",
        message: "ignored",
        metadata: { requestTitle: "Fenster putzen", cancelledBy: "provider" },
      }),
    ).toEqual({
      key: "booking_cancelled_by_provider",
      requestTitle: "Fenster putzen",
    });
  });

  it("falls back to the stored English text for older notifications", () => {
    expect(
      getNotificationTemplate({
        type: "request_cancelled",
        message: 'Your request "Umzug" has been cancelled.',
        metadata: { requestId: "r1" },
      }),
    ).toEqual({ key: "request_cancelled_customer", requestTitle: "Umzug" });
    expect(
      getNotificationTemplate({
        type: "booking_completed",
        message: 'Booking "Umzug" has been confirmed as completed.',
      }),
    ).toEqual({ key: "booking_completed_provider", requestTitle: "Umzug" });
  });

  it("returns null for unknown types", () => {
    expect(
      getNotificationTemplate({ type: "something_new", message: "x" }),
    ).toBeNull();
  });
});

describe("getNotificationHref", () => {
  it.each([
    [
      "quote_received",
      { requestId: "r1", quoteId: "q1" },
      "customer",
      "/my-requests/r1",
    ],
    ["request_cancelled", { requestId: "r1" }, "customer", "/my-requests/r1"],
    [
      "booking_completion_pending",
      { bookingId: "b1" },
      "customer",
      "/bookings/b1",
    ],
    ["booking_completed", { bookingId: "b1" }, "customer", "/bookings/b1"],
    ["booking_cancelled", { bookingId: "b1" }, "customer", "/bookings/b1"],
    [
      "quote_accepted",
      { quoteId: "q1" },
      "provider",
      "/dashboard/offers?offer=q1",
    ],
    [
      "request_cancelled",
      { quoteId: "q1" },
      "provider",
      "/dashboard/offers?offer=q1",
    ],
    [
      "booking_completed",
      { bookingId: "b1" },
      "provider",
      "/dashboard/orders?booking=b1",
    ],
    [
      "booking_cancelled",
      { bookingId: "b1" },
      "provider",
      "/dashboard/orders?booking=b1",
    ],
  ])("routes %s for %s", (type, metadata, userType, href) => {
    expect(getNotificationHref({ type, metadata }, userType)).toBe(href);
  });

  it("falls back to the role's relevant page for older metadata", () => {
    expect(
      getNotificationHref(
        { type: "request_cancelled", metadata: null },
        "provider",
      ),
    ).toBe("/dashboard/offers");
    expect(
      getNotificationHref(
        { type: "booking_completed", metadata: null },
        "customer",
      ),
    ).toBe("/bookings");
  });
});
