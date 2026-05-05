import { describe, expect, it } from "vitest";
import {
  bookingSchema,
  createServiceRequestSchema,
  providerSchema,
  registerSchema,
} from "./index.js";

describe("shared schemas", () => {
  it("requires GDPR consent during registration", () => {
    const result = registerSchema.safeParse({
      email: "customer@example.com",
      password: "Password123!",
      firstName: "Ada",
      lastName: "Lovelace",
      userType: "customer",
      gdprConsent: false,
    });

    expect(result.success).toBe(false);
  });

  it("applies default provider counters when omitted", () => {
    const parsed = providerSchema.parse({
      id: "5cb603a7-f5d6-4d64-a82a-355ef85a1e0f",
      userId: "5cb603a7-f5d6-4d64-a82a-355ef85a1e0e",
      description: "Reliable cleaning",
      experienceYears: 4,
      serviceAreaRadius: 25,
      serviceAreaLat: 52.52,
      serviceAreaLng: 13.405,
      documents: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(parsed.ratingAvg).toBe(0);
    expect(parsed.totalReviews).toBe(0);
    expect(parsed.isApproved).toBe(false);
  });

  it("accepts request creation payloads without managed fields", () => {
    const parsed = createServiceRequestSchema.parse({
      categoryId: "5cb603a7-f5d6-4d64-a82a-355ef85a1e0d",
      title: "Deep cleaning",
      description: "Kitchen and living room deep cleaning",
      location: {
        address: "Torstrasse 1",
        city: "Berlin",
        postalCode: "10115",
        lat: 52.52,
        lng: 13.405,
      },
      images: [],
    });

    expect(parsed.title).toBe("Deep cleaning");
    expect(parsed.location.city).toBe("Berlin");
  });

  it("defaults booking and payment statuses", () => {
    const parsed = bookingSchema.parse({
      id: "5cb603a7-f5d6-4d64-a82a-355ef85a1e0c",
      quoteId: "5cb603a7-f5d6-4d64-a82a-355ef85a1e0b",
      customerId: "5cb603a7-f5d6-4d64-a82a-355ef85a1e0a",
      providerId: "5cb603a7-f5d6-4d64-a82a-355ef85a1e09",
      scheduledDate: new Date(),
      totalPrice: 125,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(parsed.status).toBe("pending");
    expect(parsed.paymentStatus).toBe("pending");
  });
});
