import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { QuotesService } from "./quotes.service";

describe("QuotesService", () => {
  const prisma = {
    provider: {
      findUnique: jest.fn(),
    },
    serviceRequest: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    quote: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: QuotesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new QuotesService(prisma as any);
  });

  describe("create", () => {
    const dto = {
      requestId: "r1",
      price: 100,
      message: "Can do it",
      validUntil: "2026-03-01T00:00:00.000Z",
    } as any;

    it("enforces provider and request checks", async () => {
      prisma.provider.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "p1", isApproved: false })
        .mockResolvedValueOnce({ id: "p1", isApproved: true })
        .mockResolvedValueOnce({ id: "p1", isApproved: true })
        .mockResolvedValueOnce({ id: "p1", isApproved: true })
        .mockResolvedValueOnce({ id: "p1", isApproved: true });
      prisma.serviceRequest.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "r1", status: "closed", customerId: "c1" })
        .mockResolvedValueOnce({ id: "r1", status: "open", customerId: "c1" })
        .mockResolvedValueOnce({ id: "r1", status: "open", customerId: "c1" });
      prisma.quote.findFirst.mockResolvedValueOnce({ id: "q-existing" }).mockResolvedValueOnce(null);
      prisma.quote.create.mockResolvedValue({ id: "q1" });

      await expect(service.create("u1", dto)).rejects.toThrow(ForbiddenException);
      await expect(service.create("u1", dto)).rejects.toThrow(ForbiddenException);
      await expect(service.create("u1", dto)).rejects.toThrow(NotFoundException);
      await expect(service.create("u1", dto)).rejects.toThrow(BadRequestException);
      await expect(service.create("u1", dto)).rejects.toThrow(BadRequestException);
      await expect(service.create("u1", dto)).resolves.toEqual({ id: "q1" });
    });
  });

  describe("findByRequest", () => {
    it("checks access and returns quotes", async () => {
      prisma.serviceRequest.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "r1", customerId: "customer-1" })
        .mockResolvedValueOnce({ id: "r1", customerId: "customer-1" });
      prisma.provider.findUnique
        .mockResolvedValueOnce({ id: "provider-1" })
        .mockResolvedValueOnce(null);
      prisma.quote.findFirst.mockResolvedValueOnce(null);
      prisma.quote.findMany.mockResolvedValue([{ id: "q1" }]);

      await expect(service.findByRequest("r1", "u1")).rejects.toThrow(
        NotFoundException
      );
      await expect(service.findByRequest("r1", "u1")).rejects.toThrow(
        ForbiddenException
      );
      await expect(service.findByRequest("r1", "customer-1")).resolves.toEqual([
        { id: "q1" },
      ]);
    });
  });

  it("finds quotes by provider and customer", async () => {
    prisma.provider.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "p1" });
    prisma.quote.findMany.mockResolvedValue([{ id: "q1" }]);

    await expect(service.findByProvider("u1")).rejects.toThrow(NotFoundException);
    await expect(service.findByProvider("u1")).resolves.toEqual([{ id: "q1" }]);
    await expect(service.findByCustomer("customer-1")).resolves.toEqual([{ id: "q1" }]);
  });

  describe("findOne", () => {
    it("checks existence and access", async () => {
      prisma.quote.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "q1",
          customerId: "customer-1",
          providerId: "provider-1",
        })
        .mockResolvedValueOnce({
          id: "q1",
          customerId: "customer-1",
          providerId: "provider-1",
        });
      prisma.user.findUnique
        .mockResolvedValueOnce({ userType: "customer" })
        .mockResolvedValueOnce({ userType: "admin" });
      prisma.provider.findUnique.mockResolvedValueOnce({ id: "other-provider" });

      await expect(service.findOne("q1", "u1")).rejects.toThrow(NotFoundException);
      await expect(service.findOne("q1", "u1")).rejects.toThrow(ForbiddenException);
      await expect(service.findOne("q1", "u1")).resolves.toEqual({
        id: "q1",
        customerId: "customer-1",
        providerId: "provider-1",
      });
    });
  });

  describe("update", () => {
    it("validates provider ownership and quote status", async () => {
      prisma.provider.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "p1" })
        .mockResolvedValueOnce({ id: "p1" })
        .mockResolvedValueOnce({ id: "p1" })
        .mockResolvedValueOnce({ id: "p1" });
      prisma.quote.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "q1", providerId: "other", status: "pending" })
        .mockResolvedValueOnce({ id: "q1", providerId: "p1", status: "accepted" })
        .mockResolvedValueOnce({ id: "q1", providerId: "p1", status: "pending" });
      prisma.quote.update.mockResolvedValue({ id: "q1", price: 120 });

      await expect(service.update("q1", "u1", {} as any)).rejects.toThrow(
        ForbiddenException
      );
      await expect(service.update("q1", "u1", {} as any)).rejects.toThrow(
        NotFoundException
      );
      await expect(service.update("q1", "u1", {} as any)).rejects.toThrow(
        ForbiddenException
      );
      await expect(service.update("q1", "u1", {} as any)).rejects.toThrow(
        BadRequestException
      );
      await expect(
        service.update("q1", "u1", {
          price: 120,
          validUntil: "2026-03-05T00:00:00.000Z",
        } as any)
      ).resolves.toEqual({ id: "q1", price: 120 });
    });
  });

  describe("respond", () => {
    it("handles accepted path", async () => {
      prisma.quote.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "q1",
          customerId: "other",
          status: "pending",
          requestId: "r1",
          request: {},
        })
        .mockResolvedValueOnce({
          id: "q1",
          customerId: "customer-1",
          status: "accepted",
          requestId: "r1",
          request: {},
        })
        .mockResolvedValueOnce({
          id: "q1",
          customerId: "customer-1",
          status: "pending",
          requestId: "r1",
          request: {},
        });
      prisma.quote.update.mockReturnValue("update-op" as any);
      prisma.quote.updateMany.mockReturnValue("update-many-op" as any);
      prisma.serviceRequest.update.mockReturnValue("request-update-op" as any);
      prisma.$transaction.mockResolvedValue([]);
      jest.spyOn(service, "findOne").mockResolvedValue({ id: "q1", status: "accepted" } as any);

      await expect(service.respond("q1", "u1", "accepted")).rejects.toThrow(
        NotFoundException
      );
      await expect(service.respond("q1", "u1", "accepted")).rejects.toThrow(
        ForbiddenException
      );
      await expect(service.respond("q1", "customer-1", "accepted")).rejects.toThrow(
        BadRequestException
      );
      await expect(service.respond("q1", "customer-1", "accepted")).resolves.toEqual({
        id: "q1",
        status: "accepted",
      });
    });

    it("handles rejected path", async () => {
      prisma.quote.findUnique.mockResolvedValue({
        id: "q2",
        customerId: "customer-1",
        status: "pending",
        requestId: "r1",
        request: {},
      });
      prisma.quote.update.mockResolvedValue({ id: "q2", status: "rejected" });

      await expect(service.respond("q2", "customer-1", "rejected")).resolves.toEqual({
        id: "q2",
        status: "rejected",
      });
    });
  });

  describe("withdraw", () => {
    it("validates withdraw rules", async () => {
      prisma.provider.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "p1" })
        .mockResolvedValueOnce({ id: "p1" })
        .mockResolvedValueOnce({ id: "p1" })
        .mockResolvedValueOnce({ id: "p1" });
      prisma.quote.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "q1", providerId: "other", status: "pending" })
        .mockResolvedValueOnce({ id: "q1", providerId: "p1", status: "accepted" })
        .mockResolvedValueOnce({ id: "q1", providerId: "p1", status: "pending" });
      prisma.quote.delete.mockResolvedValue({ id: "q1" });

      await expect(service.withdraw("q1", "u1")).rejects.toThrow(ForbiddenException);
      await expect(service.withdraw("q1", "u1")).rejects.toThrow(NotFoundException);
      await expect(service.withdraw("q1", "u1")).rejects.toThrow(ForbiddenException);
      await expect(service.withdraw("q1", "u1")).rejects.toThrow(BadRequestException);
      await expect(service.withdraw("q1", "u1")).resolves.toEqual({ id: "q1" });
    });
  });
});
