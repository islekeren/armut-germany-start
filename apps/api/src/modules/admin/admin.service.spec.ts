import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { AdminService } from "./admin.service";

describe("AdminService", () => {
  const prisma = {
    user: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    provider: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    serviceRequest: {
      count: jest.fn(),
    },
    booking: {
      count: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    category: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  };

  let service: AdminService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminService(prisma as any);
  });

  it("returns dashboard stats with computed completion rate", async () => {
    prisma.user.count.mockResolvedValueOnce(100).mockResolvedValueOnce(8);
    prisma.provider.count.mockResolvedValueOnce(25).mockResolvedValueOnce(4);
    prisma.serviceRequest.count.mockResolvedValueOnce(40).mockResolvedValueOnce(12).mockResolvedValueOnce(6);
    prisma.booking.count.mockResolvedValueOnce(30).mockResolvedValueOnce(18);
    prisma.booking.aggregate.mockResolvedValue({ _sum: { totalPrice: 9500 } });

    const result = await service.getDashboardStats();
    expect(result).toEqual({
      users: { total: 100, newThisWeek: 8 },
      providers: { total: 25, pendingApproval: 4 },
      requests: { total: 40, active: 12, newThisWeek: 6 },
      bookings: {
        total: 30,
        completed: 18,
        completionRate: "60.0",
      },
      revenue: { total: 9500 },
    });
  });

  it("returns paginated users with filters", async () => {
    prisma.user.findMany.mockResolvedValue([{ id: "u1" }]);
    prisma.user.count.mockResolvedValue(11);

    const result = await service.getUsers({
      page: 2,
      limit: 5,
      userType: "customer",
      search: "max",
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userType: "customer",
          OR: expect.any(Array),
        }),
        skip: 5,
        take: 5,
      })
    );
    expect(result.meta).toEqual({
      total: 11,
      page: 2,
      limit: 5,
      totalPages: 3,
    });
  });

  it("gets user details and throws if not found", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: "u1", password: "hash" })
      .mockResolvedValueOnce(null);
    await expect(service.getUser("u1")).resolves.toEqual({ id: "u1" });
    await expect(service.getUser("missing")).rejects.toThrow(NotFoundException);
  });

  it("updates and deletes user", async () => {
    prisma.user.update.mockResolvedValue({
      id: "u1",
      isVerified: true,
      password: "hash",
    });
    prisma.user.delete.mockResolvedValue({ id: "u1", password: "hash" });

    await expect(service.updateUser("u1", { isVerified: true })).resolves.toEqual({
      id: "u1",
      isVerified: true,
    });
    await expect(service.deleteUser("u1")).resolves.toEqual({ id: "u1" });
  });

  it("returns pending providers", async () => {
    prisma.provider.findMany.mockResolvedValue([{ id: "p1" }]);
    prisma.provider.count.mockResolvedValue(3);

    const result = await service.getPendingProviders({ page: 1, limit: 2 });
    expect(result.meta).toEqual({
      total: 3,
      page: 1,
      limit: 2,
      totalPages: 2,
    });
  });

  it("returns providers with optional filters", async () => {
    prisma.provider.findMany.mockResolvedValue([{ id: "p1" }]);
    prisma.provider.count.mockResolvedValue(1);

    const result = await service.getProviders({
      isApproved: true,
      search: "clean",
      page: 1,
      limit: 10,
    });

    expect(prisma.provider.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isApproved: true,
          OR: expect.any(Array),
        }),
      })
    );
    expect(result.meta.total).toBe(1);
  });

  it("approves provider and throws if missing", async () => {
    prisma.provider.findUnique
      .mockResolvedValueOnce({ id: "p1" })
      .mockResolvedValueOnce(null);
    prisma.provider.update.mockResolvedValue({ id: "p1", isApproved: true });

    await expect(service.approveProvider("p1", true)).resolves.toEqual({
      id: "p1",
      isApproved: true,
    });
    await expect(service.approveProvider("missing", true)).rejects.toThrow(
      NotFoundException
    );
  });

  it("gets, creates and updates categories", async () => {
    prisma.category.findMany.mockResolvedValue([{ id: "c1" }]);
    prisma.category.findUnique
      .mockResolvedValueOnce({
        id: "sector-1",
        slug: "home-repair",
        parentId: null,
      })
      .mockResolvedValueOnce({
        id: "c1",
        slug: "electrician",
      });
    prisma.category.create.mockResolvedValue({ id: "c2" });
    prisma.category.update.mockResolvedValue({
      id: "c1",
      nameDe: "Elektriker",
    });

    await expect(service.getCategories()).resolves.toEqual([{ id: "c1" }]);
    await expect(
      service.createCategory({
        slug: "electrician",
        nameDe: "Elektriker",
        nameEn: "Electrician",
        icon: "⚡",
        parentId: "sector-1",
      })
    ).resolves.toEqual({ id: "c2" });
    expect(prisma.category.findUnique).toHaveBeenCalledWith({
      where: { id: "sector-1" },
      select: {
        id: true,
        slug: true,
        parentId: true,
      },
    });
    expect(prisma.category.create).toHaveBeenCalledWith({
      data: {
        slug: "electrician",
        nameDe: "Elektriker",
        nameEn: "Electrician",
        icon: "⚡",
        parentId: "sector-1",
        isActive: true,
      },
    });
    await expect(
      service.updateCategory("c1", { nameDe: "Elektriker" })
    ).resolves.toEqual({
      id: "c1",
      nameDe: "Elektriker",
    });
  });

  it("rejects taxonomy drift in category creation", async () => {
    prisma.category.findUnique.mockResolvedValue(null);

    await expect(
      service.createCategory({
        slug: "custom-cleaning",
        nameDe: "Custom",
        nameEn: "Custom",
        icon: "🧪",
      })
    ).rejects.toThrow(BadRequestException);

    expect(prisma.category.create).not.toHaveBeenCalled();
  });

  it("rejects taxonomy drift in category updates", async () => {
    prisma.category.findUnique.mockResolvedValue({
      id: "c1",
      slug: "electrician",
    });

    await expect(
      service.updateCategory("c1", { nameDe: "Neu" })
    ).rejects.toThrow(BadRequestException);

    expect(prisma.category.update).not.toHaveBeenCalled();
  });

  it("deletes category and enforces service/request constraints", async () => {
    prisma.category.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "c1",
        _count: { services: 1, serviceRequests: 0 },
      })
      .mockResolvedValueOnce({
        id: "c2",
        _count: { services: 0, serviceRequests: 0 },
      });
    prisma.category.delete.mockResolvedValue({ id: "c2" });

    await expect(service.deleteCategory("missing")).rejects.toThrow(NotFoundException);
    await expect(service.deleteCategory("c1")).rejects.toThrow(ForbiddenException);
    await expect(service.deleteCategory("c2")).resolves.toEqual({ id: "c2" });
  });

  it("returns revenue report grouped by day", async () => {
    prisma.booking.findMany.mockResolvedValue([
      { completedAt: new Date("2026-02-10T10:00:00.000Z"), totalPrice: 100 },
      { completedAt: new Date("2026-02-10T11:00:00.000Z"), totalPrice: 50 },
      { completedAt: new Date("2026-02-11T11:00:00.000Z"), totalPrice: 40 },
    ]);

    const result = await service.getRevenueReport(
      new Date("2026-02-01"),
      new Date("2026-02-28")
    );

    expect(result.totalRevenue).toBe(190);
    expect(result.bookingsCount).toBe(3);
    expect(result.dailyRevenue).toContainEqual({ date: "2026-02-10", revenue: 150 });
    expect(result.dailyRevenue).toContainEqual({ date: "2026-02-11", revenue: 40 });
  });

  it("returns category report", async () => {
    prisma.category.findMany.mockResolvedValue([
      {
        id: "c1",
        nameDe: "Reinigung",
        icon: "broom",
        _count: { services: 3, serviceRequests: 5 },
        serviceRequests: [{ id: "r1" }, { id: "r2" }],
      },
    ]);

    await expect(service.getCategoryReport()).resolves.toEqual([
      {
        id: "c1",
        name: "Reinigung",
        icon: "broom",
        totalServices: 3,
        totalRequests: 5,
        completedRequests: 2,
      },
    ]);
  });

  it("returns top providers", async () => {
    prisma.provider.findMany.mockResolvedValue([{ id: "p1" }]);
    await expect(service.getTopProviders()).resolves.toEqual([{ id: "p1" }]);
    expect(prisma.provider.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isApproved: true },
        take: 10,
      })
    );
  });
});
