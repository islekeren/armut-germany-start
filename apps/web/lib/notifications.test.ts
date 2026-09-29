import { describe, expect, it } from "vitest";
import { getNotificationTemplate } from "./notifications";

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
