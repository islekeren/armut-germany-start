import { Test, TestingModule } from "@nestjs/testing";
import { ProvidersService } from "./providers.service";
import { PrismaService } from "../../common/prisma/prisma.service";
import { NotFoundException, ForbiddenException } from "@nestjs/common";

describe("ProvidersService", () => {
  let service: ProvidersService;
  let prisma: any;

  const mockProvider = {
    id: "provider-1",
    userId: "user-1",
    companyName: "Test GmbH",
    description: "Test description",
    taxId: "DE123456789",
    experienceYears: 5,
    serviceAreaLat: 52.52,
    serviceAreaLng: 13.405,
    serviceAreaRadius: 25,
    ratingAvg: 4.5,
    totalReviews: 10,
    isApproved: true,
    documents: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {
      id: "user-1",
      firstName: "Max",
      lastName: "Mustermann",
      email: "max@example.com",
      profileImage: null,
    },
    services: [],
  };

  beforeEach(async () => {
    const mockPrismaService = {
      provider: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      quote: {
        count: jest.fn(),
      },
      booking: {
        count: jest.fn(),
        aggregate: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProvidersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ProvidersService>(ProvidersService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("findAll", () => {
    it("should return paginated providers", async () => {
      const mockProviders = [mockProvider];
      prisma.provider.findMany.mockResolvedValue(mockProviders);
      prisma.provider.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.data).toEqual(mockProviders);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it("should filter by category", async () => {
      prisma.provider.findMany.mockResolvedValue([mockProvider]);
      prisma.provider.count.mockResolvedValue(1);

      await service.findAll({ categoryId: "category-1" });

      expect(prisma.provider.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            services: { some: { categoryId: "category-1", isActive: true } },
          }),
        })
      );
    });

    it("should filter by minimum rating", async () => {
      prisma.provider.findMany.mockResolvedValue([mockProvider]);
      prisma.provider.count.mockResolvedValue(1);

      await service.findAll({ minRating: 4 });

      expect(prisma.provider.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            ratingAvg: { gte: 4 },
          }),
        })
      );
    });
  });

  describe("findOne", () => {
    it("should return a provider by id", async () => {
      prisma.provider.findUnique.mockResolvedValue(mockProvider);

      const result = await service.findOne("provider-1");

      expect(result).toEqual(mockProvider);
      expect(prisma.provider.findUnique).toHaveBeenCalledWith({
        where: { id: "provider-1" },
        include: expect.any(Object),
      });
    });

    it("should throw NotFoundException if provider not found", async () => {
      prisma.provider.findUnique.mockResolvedValue(null);

      await expect(service.findOne("non-existent")).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe("update", () => {
    it("should update provider successfully", async () => {
      prisma.provider.findUnique.mockResolvedValue(mockProvider);
      prisma.provider.update.mockResolvedValue({
        ...mockProvider,
        description: "Updated description",
      });

      const result = await service.update("provider-1", "user-1", {
        description: "Updated description",
      });

      expect(result.description).toBe("Updated description");
    });

    it("should throw ForbiddenException if user is not owner", async () => {
      prisma.provider.findUnique.mockResolvedValue(mockProvider);

      await expect(
        service.update("provider-1", "other-user", {
          description: "Updated",
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw NotFoundException if provider not found", async () => {
      prisma.provider.findUnique.mockResolvedValue(null);

      await expect(
        service.update("non-existent", "user-1", {
          description: "Updated",
        })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("approve", () => {
    it("should approve provider successfully", async () => {
      prisma.provider.findUnique.mockResolvedValue({
        ...mockProvider,
        isApproved: false,
      });
      prisma.provider.update.mockResolvedValue({
        ...mockProvider,
        isApproved: true,
      });

      const result = await service.approve("provider-1", true);

      expect(result.isApproved).toBe(true);
      expect(prisma.provider.update).toHaveBeenCalledWith({
        where: { id: "provider-1" },
        data: { isApproved: true },
      });
    });

    it("should throw NotFoundException if provider not found", async () => {
      prisma.provider.findUnique.mockResolvedValue(null);

      await expect(service.approve("non-existent", true)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe("getStats", () => {
    it("should return provider statistics", async () => {
      prisma.provider.findUnique.mockResolvedValue(mockProvider);
      prisma.quote.count.mockResolvedValue(10);
      prisma.booking.count.mockResolvedValue(5);
      prisma.booking.aggregate.mockResolvedValue({ _sum: { totalPrice: 1500 } });

      const result = await service.getStats("user-1");

      expect(result).toHaveProperty("totalQuotes");
      expect(result).toHaveProperty("completedBookings");
      expect(result).toHaveProperty("rating");
    });

    it("should throw NotFoundException if provider not found", async () => {
      prisma.provider.findUnique.mockResolvedValue(null);

      await expect(service.getStats("other-user")).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
