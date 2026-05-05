import { describe, expect, it } from "vitest";
import type { CustomerBooking, Quote } from "./api";
import {
  formatEuroAmount,
  getBookingDisplayStatusClass,
  getDefaultScheduledDateValue,
  getProviderContactName,
  getProviderDisplayName,
  getRequestLocation,
  getRequestTitle,
  toBookingDisplayStatus,
} from "./bookings";

describe("bookings helpers", () => {
  it("prefers the company name when building provider labels", () => {
    const provider = {
      id: "provider-1",
      companyName: "Spark Clean",
      user: {
        id: "user-1",
        firstName: "Ada",
        lastName: "Lovelace",
      },
    } satisfies NonNullable<CustomerBooking["provider"]>;

    expect(getProviderDisplayName(provider)).toBe("Spark Clean");
    expect(getProviderContactName(provider)).toBe("Ada Lovelace");
  });

  it("falls back gracefully when request details are missing", () => {
    expect(getRequestTitle(null)).toBe("Service request");
    expect(getRequestLocation(null)).toBe("Location not provided");

    expect(
      getRequestLocation(
        {
          id: "request-1",
        address: "Torstrasse 1",
        postalCode: "10115",
        city: "Berlin",
        } satisfies NonNullable<Quote["request"]>,
      ),
    ).toBe("Torstrasse 1, 10115, Berlin");
  });

  it("maps booking states into the UI status buckets", () => {
    expect(toBookingDisplayStatus("completion_pending")).toBe("booked");
    expect(toBookingDisplayStatus("completed")).toBe("completed");
    expect(toBookingDisplayStatus("cancelled")).toBe("cancelled");
    expect(toBookingDisplayStatus("pending")).toBe("pending");
    expect(getBookingDisplayStatusClass("booked")).toContain("bg-blue-100");
  });

  it("formats EUR values and produces a local datetime default", () => {
    expect(formatEuroAmount(125, "de")).toContain("125");
    expect(getDefaultScheduledDateValue()).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
    );
  });
});
