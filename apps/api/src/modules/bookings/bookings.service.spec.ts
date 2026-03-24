import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { BookingsService } from "./bookings.service";

describe("BookingsService", () => {
  const prisma = {
    quote: {
      findUnique: jest.fn(),
    },
    booking: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    provider: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    serviceRequest: {
      update: jest.fn(),
    },
    review: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };
  const notificationsService = {
    create: jest.fn(),
  };

  let service: BookingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BookingsService(prisma as any, notificationsService as any);
  });

  describe("create", () => {
    const dto = {
      quoteId: "q1",
      scheduledDate: "2026-03-01T10:00:00.000Z",
    } as any;

    it("validates quote state before creating", async () => {
      prisma.quote.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "q1",
          customerId: "other",
          status: "accepted",
          providerId: "p1",
          price: 100,
        })
        .mockResolvedValueOnce({
          id: "q1",
          customerId: "customer-1",
          status: "pending",
          providerId: "p1",
          price: 100,
        })
        .mockResolvedValueOnce({
          id: "q1",
          customerId: "customer-1",
          status: "accepted",
          providerId: "p1",
          price: 100,
        })
        .mockResolvedValueOnce({
          id: "q1",
          customerId: "customer-1",
          status: "accepted",
          providerId: "p1",
          price: 100,
        });
      prisma.booking.findUnique
        .mockResolvedValueOnce({ id: "b-existing" })
        .mockResolvedValueOnce(null);
      prisma.booking.create.mockResolvedValue({ id: "b1" });

      await expect(service.create("customer-1", dto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create("customer-1", dto)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.create("customer-1", dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create("customer-1", dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create("customer-1", dto)).resolves.toEqual({
        id: "b1",
      });
    });
  });

  it("finds bookings by customer", async () => {
    prisma.booking.findMany.mockResolvedValue([{ id: "b1" }]);
    prisma.booking.count.mockResolvedValue(5);

    const result = await service.findByCustomer("customer-1", {
      page: 1,
      limit: 2,
      status: "pending",
    } as any);

    expect(result.meta).toEqual({
      total: 5,
      page: 1,
      limit: 2,
      totalPages: 3,
    });
  });

  it("finds bookings by provider and validates provider presence", async () => {
    prisma.provider.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "p1" });
    prisma.booking.findMany.mockResolvedValue([{ id: "b1" }]);
    prisma.booking.count.mockResolvedValue(1);

    await expect(
      service.findByProvider("provider-user", { page: 1, limit: 10 } as any),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.findByProvider("provider-user", { page: 1, limit: 10 } as any),
    ).resolves.toEqual({
      data: [{ id: "b1" }],
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    });
  });

  it("gets one booking and enforces detail access rules", async () => {
    prisma.booking.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "b1",
        customerId: "customer-1",
        provider: { userId: "provider-user" },
      })
      .mockResolvedValueOnce({
        id: "b1",
        customerId: "customer-1",
        provider: { userId: "provider-user" },
      })
      .mockResolvedValueOnce({
        id: "b1",
        customerId: "customer-1",
        provider: { userId: "provider-user" },
      })
      .mockResolvedValueOnce({
        id: "b1",
        customerId: "customer-1",
        provider: { userId: "provider-user" },
      });

    await expect(
      service.findOne("missing", { id: "customer-1", userType: "customer" })
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.findOne("b1", { id: "other-user", userType: "customer" })
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.findOne("b1", { id: "customer-1", userType: "customer" })
    ).resolves.toEqual({
      id: "b1",
      customerId: "customer-1",
      provider: { userId: "provider-user" },
    });
    await expect(
      service.findOne("b1", { id: "provider-user", userType: "provider" })
    ).resolves.toEqual({
      id: "b1",
      customerId: "customer-1",
      provider: { userId: "provider-user" },
    });
    await expect(
      service.findOne("b1", { id: "admin-1", userType: "admin" })
    ).resolves.toEqual({
      id: "b1",
      customerId: "customer-1",
      provider: { userId: "provider-user" },
    });

    const bookingDetailQuery = prisma.booking.findUnique.mock.calls[0][0];
    expect(bookingDetailQuery.select.provider.select.user.select).toEqual({
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      profileImage: true,
    });
    expect(bookingDetailQuery.select.provider.select.user.select).not.toHaveProperty(
      "email"
    );
    expect(bookingDetailQuery.select.customer.select).toEqual({
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      profileImage: true,
    });
    expect(bookingDetailQuery.select.customer.select).not.toHaveProperty("email");
  });

  describe("updateStatus", () => {
    it("enforces actor and transition rules", async () => {
      prisma.booking.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "b1",
          status: "pending",
          customerId: "customer-1",
          provider: { userId: "provider-user" },
          quote: { requestId: "r1" },
        })
        .mockResolvedValueOnce({
          id: "b1",
          status: "completed",
          customerId: "customer-1",
          provider: { userId: "provider-user" },
          quote: { requestId: "r1" },
        })
        .mockResolvedValueOnce({
          id: "b1",
          status: "pending",
          customerId: "customer-1",
          provider: { userId: "provider-user" },
          quote: { requestId: "r1" },
        })
        .mockResolvedValueOnce({
          id: "b1",
          status: "in_progress",
          customerId: "customer-1",
          provider: { userId: "provider-user" },
          quote: { requestId: "r1" },
        })
        .mockResolvedValueOnce({
          id: "b1",
          status: "completion_pending",
          customerId: "customer-1",
          provider: { userId: "provider-user" },
          quote: { requestId: "r1" },
        });
      prisma.booking.update.mockResolvedValue({
        id: "b1",
        status: "completed",
        quote: {
          requestId: "r1",
          request: { id: "r1", title: "Test request" },
        },
        customer: {
          id: "customer-1",
          firstName: "Ada",
          lastName: "Customer",
        },
        provider: {
          user: {
            id: "provider-user",
            firstName: "Pat",
            lastName: "Provider",
          },
        },
      });
      prisma.serviceRequest.update.mockResolvedValue({
        id: "r1",
        status: "completed",
      });

      await expect(
        service.updateStatus("b1", "x", "confirmed"),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.updateStatus("b1", "x", "confirmed"),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.updateStatus("b1", "provider-user", "confirmed"),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateStatus("b1", "customer-1", "confirmed"),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.updateStatus("b1", "provider-user", "completed"),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateStatus("b1", "customer-1", "completed"),
      ).resolves.toEqual(
        expect.objectContaining({ id: "b1", status: "completed" }),
      );
      expect(prisma.serviceRequest.update).toHaveBeenCalledWith({
        where: { id: "r1" },
        data: { status: "completed" },
      });
    });
  });

  describe("reschedule", () => {
    it("enforces ownership and status rules", async () => {
      prisma.booking.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "b1",
          customerId: "other",
          status: "pending",
        })
        .mockResolvedValueOnce({
          id: "b1",
          customerId: "customer-1",
          status: "completed",
        })
        .mockResolvedValueOnce({
          id: "b1",
          customerId: "customer-1",
          status: "confirmed",
        });
      prisma.booking.update.mockResolvedValue({ id: "b1", status: "pending" });

      await expect(
        service.reschedule("b1", "customer-1", "2026-03-02"),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.reschedule("b1", "customer-1", "2026-03-02"),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.reschedule("b1", "customer-1", "2026-03-02"),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.reschedule("b1", "customer-1", "2026-03-02"),
      ).resolves.toEqual({
        id: "b1",
        status: "pending",
      });
    });
  });

  describe("createReview", () => {
    it("validates booking state and updates provider rating", async () => {
      prisma.booking.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "b1",
          customerId: "other",
          status: "completed",
          providerId: "p1",
          provider: { userId: "provider-user" },
          review: null,
        })
        .mockResolvedValueOnce({
          id: "b1",
          customerId: "customer-1",
          status: "confirmed",
          providerId: "p1",
          provider: { userId: "provider-user" },
          review: null,
        })
        .mockResolvedValueOnce({
          id: "b1",
          customerId: "customer-1",
          status: "completed",
          providerId: "p1",
          provider: { userId: "provider-user" },
          review: { id: "r-existing" },
        })
        .mockResolvedValueOnce({
          id: "b1",
          customerId: "customer-1",
          status: "completed",
          providerId: "p1",
          provider: { userId: "provider-user" },
          review: null,
        });
      prisma.review.create.mockResolvedValue({ id: "r1", rating: 5 });
      prisma.review.findMany.mockResolvedValue([{ rating: 4 }, { rating: 5 }]);
      prisma.provider.update.mockResolvedValue({ id: "p1", ratingAvg: 4.5 });

      await expect(
        service.createReview("b1", "customer-1", {
          rating: 5,
          comment: "Great",
        } as any),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.createReview("b1", "customer-1", {
          rating: 5,
          comment: "Great",
        } as any),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.createReview("b1", "customer-1", {
          rating: 5,
          comment: "Great",
        } as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createReview("b1", "customer-1", {
          rating: 5,
          comment: "Great",
        } as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createReview("b1", "customer-1", {
          rating: 5,
          comment: "Great",
        } as any),
      ).resolves.toEqual({ id: "r1", rating: 5 });
      expect(prisma.provider.update).toHaveBeenCalledWith({
        where: { id: "p1" },
        data: { ratingAvg: 4.5, totalReviews: 2 },
      });
    });
  });

  describe("addProviderReply", () => {
    it("validates provider ownership and review presence", async () => {
      prisma.booking.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "b1",
          provider: { userId: "other-provider" },
          review: { id: "r1" },
        })
        .mockResolvedValueOnce({
          id: "b1",
          provider: { userId: "provider-user" },
          review: null,
        })
        .mockResolvedValueOnce({
          id: "b1",
          provider: { userId: "provider-user" },
          review: { id: "r1" },
        });
      prisma.review.update.mockResolvedValue({
        id: "r1",
        providerReply: "Thanks",
      });

      await expect(
        service.addProviderReply("b1", "provider-user", "Thanks"),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.addProviderReply("b1", "provider-user", "Thanks"),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.addProviderReply("b1", "provider-user", "Thanks"),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.addProviderReply("b1", "provider-user", "Thanks"),
      ).resolves.toEqual({ id: "r1", providerReply: "Thanks" });
    });
  });

  describe("getUpcoming", () => {
    it("returns upcoming bookings for customer", async () => {
      prisma.booking.findMany.mockResolvedValue([{ id: "b1" }]);
      await expect(
        service.getUpcoming("customer-1", "customer"),
      ).resolves.toEqual([{ id: "b1" }]);
    });

    it("returns upcoming bookings for provider and validates provider", async () => {
      prisma.provider.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "p1" });
      prisma.booking.findMany.mockResolvedValue([{ id: "b2" }]);

      await expect(
        service.getUpcoming("provider-user", "provider"),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getUpcoming("provider-user", "provider"),
      ).resolves.toEqual([{ id: "b2" }]);
    });
  });
});
