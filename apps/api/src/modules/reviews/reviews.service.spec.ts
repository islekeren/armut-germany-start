import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { ReviewsService } from "./reviews.service";

describe("ReviewsService", () => {
  const prisma = {
    booking: {
      findUnique: jest.fn(),
    },
    provider: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    review: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  };

  let service: ReviewsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReviewsService(prisma as any);
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

  describe("getReviews", () => {
    it("throws when the requester has no provider profile", async () => {
      prisma.provider.findUnique.mockResolvedValue(null);

      await expect(
        service.getReviews("no-provider-user", {}),
      ).rejects.toThrow(NotFoundException);
    });

    it("returns paginated reviews with a rating breakdown", async () => {
      prisma.provider.findUnique.mockResolvedValue({
        userId: "provider-user",
        ratingAvg: 4.5,
      });
      prisma.review.findMany.mockResolvedValue([
        {
          id: "r1",
          reviewer: { firstName: "Jane", lastName: "Doe" },
          rating: 5,
          createdAt: new Date("2026-01-01"),
          bookingId: "b1",
          comment: "Great work",
          providerReply: null,
          images: [],
          providerReplyImages: [],
          booking: {
            quote: { request: { id: "req1", title: "Plumbing" } },
          },
        },
      ]);
      prisma.review.count.mockResolvedValue(1);
      prisma.review.groupBy.mockResolvedValue([
        { rating: 5, _count: { rating: 1 } },
      ]);

      const result = await service.getReviews("provider-user", { page: 1, limit: 10 });

      expect(result.data).toEqual([
        {
          id: "r1",
          customer: "Jane Doe",
          rating: 5,
          date: new Date("2026-01-01"),
          service: "Plumbing",
          job: { bookingId: "b1", requestId: "req1", title: "Plumbing" },
          customerComment: "Great work",
          comment: "Great work",
          reply: null,
          images: [],
          replyImages: [],
        },
      ]);
      expect(result.stats).toEqual({
        average: 4.5,
        total: 1,
        breakdown: { 5: 1, 4: 0, 3: 0, 2: 0, 1: 0 },
      });
    });
  });

  describe("replyToReview", () => {
    it("validates provider ownership of the review", async () => {
      prisma.provider.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ userId: "provider-user" })
        .mockResolvedValueOnce({ userId: "provider-user" });
      prisma.review.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "r1", revieweeId: "other-provider" });

      await expect(
        service.replyToReview("provider-user", "r1", "Thanks!"),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.replyToReview("provider-user", "r1", "Thanks!"),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.replyToReview("provider-user", "r1", "Thanks!"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("replies when the provider owns the review", async () => {
      prisma.provider.findUnique.mockResolvedValue({ userId: "provider-user" });
      prisma.review.findUnique.mockResolvedValue({
        id: "r1",
        revieweeId: "provider-user",
      });
      prisma.review.update.mockResolvedValue({
        id: "r1",
        providerReply: "Thanks!",
      });

      await expect(
        service.replyToReview("provider-user", "r1", "Thanks!"),
      ).resolves.toEqual({ id: "r1", providerReply: "Thanks!" });
    });
  });
});
