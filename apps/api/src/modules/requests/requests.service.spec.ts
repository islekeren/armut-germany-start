import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { RequestsService } from "./requests.service";

describe("RequestsService", () => {
  const prisma = {
    category: {
      findUnique: jest.fn(),
    },
    serviceRequest: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    provider: {
      findUnique: jest.fn(),
    },
  };
  const notificationsService = {
    create: jest.fn(),
  };

  let service: RequestsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RequestsService(prisma as any, notificationsService as any);
  });

  describe("create", () => {
    it("rejects non-customer users", async () => {
      await expect(
        service.create(
          "provider-user-1",
          {
            categoryId: "home-cleaning",
            title: "Need cleaning",
            description: "flat",
          } as any,
          "provider",
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.category.findUnique).not.toHaveBeenCalled();
      expect(prisma.serviceRequest.create).not.toHaveBeenCalled();
    });

    it("creates request when category id is uuid", async () => {
      const categoryId = "550e8400-e29b-41d4-a716-446655440000";
      prisma.category.findUnique.mockResolvedValue({
        id: "cat-1",
        slug: "electrician",
        parentId: "sector-1",
        isActive: true,
      });
      prisma.serviceRequest.create.mockResolvedValue({ id: "req-1" });

      await expect(
        service.create("user-1", {
          categoryId,
          title: "Need cleaning",
          description: "flat",
        } as any),
      ).resolves.toEqual({ id: "req-1" });

      expect(prisma.category.findUnique).toHaveBeenCalledWith({
        where: { id: categoryId },
      });
      expect(prisma.serviceRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerId: "user-1",
            categoryId: "cat-1",
          }),
        }),
      );
    });

    it("creates request when category id is slug", async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: "cat-2",
        slug: "home-cleaning",
        parentId: "sector-1",
        isActive: true,
      });
      prisma.serviceRequest.create.mockResolvedValue({ id: "req-2" });

      await service.create("user-1", {
        categoryId: "home-cleaning",
        title: "Need cleaning",
        description: "flat",
      } as any);

      expect(prisma.category.findUnique).toHaveBeenCalledWith({
        where: { slug: "home-cleaning" },
      });
    });

    it("rejects legacy broad categories", async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: "cat-2",
        slug: "cleaning",
        parentId: null,
        isActive: true,
      });

      await expect(
        service.create("user-1", {
          categoryId: "cleaning",
          title: "Need cleaning",
          description: "flat",
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws when category is not found", async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.create("user-1", {
          categoryId: "home-cleaning",
          title: "Need cleaning",
          description: "flat",
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it("rejects inactive categories", async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: "cat-1",
        slug: "home-cleaning",
        parentId: "sector-1",
        isActive: false,
      });

      await expect(
        service.create("user-1", {
          categoryId: "home-cleaning",
          title: "Need cleaning",
          description: "flat",
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it("rejects leaf categories missing from the request taxonomy", async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: "cat-9",
        slug: "custom-cleaning",
        parentId: "sector-1",
        isActive: true,
      });

      await expect(
        service.create("user-1", {
          categoryId: "custom-cleaning",
          title: "Need cleaning",
          description: "flat",
        } as any),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.serviceRequest.create).not.toHaveBeenCalled();
    });

    it("normalizes sector from a valid branch", async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: "cat-1",
        slug: "office-cleaning",
        parentId: "sector-1",
        isActive: true,
      });
      prisma.serviceRequest.create.mockResolvedValue({ id: "req-3" });

      await service.create("user-1", {
        categoryId: "office-cleaning",
        requestBranch: "office-cleaning",
        title: "Need cleaning",
        description: "flat",
      } as any);

      expect(prisma.serviceRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            categoryId: "cat-1",
            requestBranch: "office-cleaning",
            requestSector: "cleaning-care",
          }),
        }),
      );
    });

    it("rejects mismatched branch/category combinations", async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: "cat-1",
        slug: "home-cleaning",
        parentId: "sector-1",
        isActive: true,
      });

      await expect(
        service.create("user-1", {
          categoryId: "home-cleaning",
          requestBranch: "electrician",
          title: "Need cleaning",
          description: "flat",
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects mismatched sector/branch combinations", async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: "cat-1",
        slug: "office-cleaning",
        parentId: "sector-1",
        isActive: true,
      });

      await expect(
        service.create("user-1", {
          categoryId: "office-cleaning",
          requestSector: "digital-tech",
          requestBranch: "office-cleaning",
          title: "Need cleaning",
          description: "flat",
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("findAll", () => {
    it("returns paginated requests with postal filtering", async () => {
      prisma.serviceRequest.findMany.mockResolvedValue([{ id: "r1" }]);
      prisma.serviceRequest.count.mockResolvedValue(14);

      const result = await service.findAll({
        postalCode: "10115",
        page: 2,
        limit: 5,
      } as any);

      expect(prisma.serviceRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "open",
            postalCode: { startsWith: "10" },
          }),
          skip: 5,
          take: 5,
        }),
      );
      expect(result.meta).toEqual({
        total: 14,
        page: 2,
        limit: 5,
        totalPages: 3,
      });
    });

    it("filters requests by category slug", async () => {
      prisma.serviceRequest.findMany.mockResolvedValue([{ id: "r1" }]);
      prisma.serviceRequest.count.mockResolvedValue(1);

      await service.findAll({
        categorySlug: "home-cleaning",
        page: 1,
        limit: 10,
      } as any);

      expect(prisma.serviceRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "open",
            category: { slug: "home-cleaning" },
          }),
        }),
      );
      expect(prisma.serviceRequest.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "open",
            category: { slug: "home-cleaning" },
          }),
        }),
      );
    });

    it("filters requests by city when using the legacy city query", async () => {
      prisma.serviceRequest.findMany.mockResolvedValue([{ id: "r1" }]);
      prisma.serviceRequest.count.mockResolvedValue(1);

      await service.findAll({
        city: "Berlin",
        page: 1,
        limit: 10,
      } as any);

      expect(prisma.serviceRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "open",
            city: { contains: "Berlin", mode: "insensitive" },
          }),
        }),
      );
      expect(prisma.serviceRequest.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "open",
            city: { contains: "Berlin", mode: "insensitive" },
          }),
        }),
      );
    });

    it("filters by distance when lat/lng/radius are provided", async () => {
      prisma.serviceRequest.findMany.mockResolvedValue([
        { id: "near", lat: 52.52, lng: 13.405 },
        { id: "far", lat: 48.13, lng: 11.58 },
      ]);
      prisma.serviceRequest.count.mockResolvedValue(2);

      const result = await service.findAll({
        lat: 52.52,
        lng: 13.405,
        radius: 50,
      } as any);

      expect(result.data).toEqual([{ id: "near", lat: 52.52, lng: 13.405 }]);
    });
  });

  describe("findByCustomer", () => {
    it("loads customer requests with optional status", async () => {
      prisma.serviceRequest.findMany.mockResolvedValue([{ id: "r1" }]);
      await expect(service.findByCustomer("u1", "open")).resolves.toEqual([
        { id: "r1" },
      ]);
      expect(prisma.serviceRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { customerId: "u1", status: "open" },
        }),
      );
    });
  });

  describe("findOne", () => {
    it("returns request by id", async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue({ id: "r1" });
      await expect(service.findOne("r1")).resolves.toEqual({ id: "r1" });
    });

    it("throws when request is missing", async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(null);
      await expect(service.findOne("missing")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("update", () => {
    it("throws when request is missing", async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(null);
      await expect(service.update("r1", "u1", {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws when request owner does not match", async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue({
        id: "r1",
        customerId: "other",
      });
      await expect(service.update("r1", "u1", {} as any)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("updates request for owner", async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue({
        id: "r1",
        customerId: "u1",
      });
      prisma.serviceRequest.update.mockResolvedValue({
        id: "r1",
        title: "Updated",
      });

      await expect(
        service.update("r1", "u1", {
          title: "Updated",
          preferredDate: "2026-02-24T12:00:00.000Z",
        } as any),
      ).resolves.toEqual({ id: "r1", title: "Updated" });

      expect(prisma.serviceRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "r1" },
          data: expect.objectContaining({
            title: "Updated",
            preferredDate: new Date("2026-02-24T12:00:00.000Z"),
          }),
        }),
      );
    });
  });

  describe("cancel", () => {
    it("throws when request is missing", async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(null);
      await expect(service.cancel("r1", "u1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws when request owner does not match", async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue({
        id: "r1",
        customerId: "other",
        status: "open",
      });
      await expect(service.cancel("r1", "u1")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("throws when request is not open", async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue({
        id: "r1",
        customerId: "u1",
        status: "in_progress",
      });
      await expect(service.cancel("r1", "u1")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("cancels open request", async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue({
        id: "r1",
        customerId: "u1",
        status: "open",
      });
      prisma.serviceRequest.update.mockResolvedValue({
        id: "r1",
        status: "cancelled",
      });

      await expect(service.cancel("r1", "u1")).resolves.toEqual({
        id: "r1",
        status: "cancelled",
      });
      expect(prisma.serviceRequest.update).toHaveBeenCalledWith({
        where: { id: "r1" },
        data: { status: "cancelled" },
      });
    });
  });

  describe("getForProvider", () => {
    it("throws when provider is missing", async () => {
      prisma.provider.findUnique.mockResolvedValue(null);
      await expect(service.getForProvider("p1", {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("returns provider-suitable requests filtered by service area", async () => {
      prisma.provider.findUnique.mockResolvedValue({
        id: "p1",
        serviceAreaLat: 52.52,
        serviceAreaLng: 13.405,
        serviceAreaRadius: 50,
        services: [{ categoryId: "cat-1" }],
      });
      prisma.serviceRequest.findMany.mockResolvedValue([
        { id: "near", lat: 52.52, lng: 13.405 },
        { id: "far", lat: 48.13, lng: 11.58 },
      ]);

      const result = await service.getForProvider("p1", {
        page: 1,
        limit: 10,
      } as any);

      expect(prisma.serviceRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "open",
            categoryId: { in: ["cat-1"] },
          }),
        }),
      );
      expect(result).toEqual({
        data: [{ id: "near", lat: 52.52, lng: 13.405 }],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      });
    });
  });
});
