import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // ==================== Dashboard Stats ====================

  async getDashboardStats() {
    const [
      totalUsers,
      totalProviders,
      pendingProviders,
      totalRequests,
      activeRequests,
      totalBookings,
      completedBookings,
      totalRevenue,
      recentUsers,
      recentRequests,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.provider.count(),
      this.prisma.provider.count({ where: { isApproved: false } }),
      this.prisma.serviceRequest.count(),
      this.prisma.serviceRequest.count({ where: { status: "open" } }),
      this.prisma.booking.count(),
      this.prisma.booking.count({ where: { status: "completed" } }),
      this.prisma.booking.aggregate({
        where: { paymentStatus: "paid" },
        _sum: { totalPrice: true },
      }),
      this.prisma.user.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.serviceRequest.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    return {
      users: {
        total: totalUsers,
        newThisWeek: recentUsers,
      },
      providers: {
        total: totalProviders,
        pendingApproval: pendingProviders,
      },
      requests: {
        total: totalRequests,
        active: activeRequests,
        newThisWeek: recentRequests,
      },
      bookings: {
        total: totalBookings,
        completed: completedBookings,
        completionRate:
          totalBookings > 0
            ? ((completedBookings / totalBookings) * 100).toFixed(1)
            : 0,
      },
      revenue: {
        total: totalRevenue._sum.totalPrice || 0,
      },
    };
  }

  // ==================== User Management ====================

  async getUsers(query: {
    page?: number;
    limit?: number;
    userType?: string;
    search?: string;
  }) {
    const { page = 1, limit = 20, userType, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (userType) {
      where.userType = userType;
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          userType: true,
          isVerified: true,
          createdAt: true,
          _count: {
            select: {
              serviceRequests: true,
              bookingsAsCustomer: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        provider: true,
        serviceRequests: {
          take: 10,
          orderBy: { createdAt: "desc" },
        },
        bookingsAsCustomer: {
          take: 10,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }

  async updateUser(id: string, data: { isVerified?: boolean }) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async deleteUser(id: string) {
    // Soft delete or hard delete based on requirements
    return this.prisma.user.delete({
      where: { id },
    });
  }

  // ==================== Provider Management ====================

  async getPendingProviders(query: { page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [providers, total] = await Promise.all([
      this.prisma.provider.findMany({
        where: { isApproved: false },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              createdAt: true,
            },
          },
        },
      }),
      this.prisma.provider.count({ where: { isApproved: false } }),
    ]);

    return {
      data: providers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getProviders(query: {
    page?: number;
    limit?: number;
    isApproved?: boolean;
    search?: string;
  }) {
    const { page = 1, limit = 20, isApproved, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (isApproved !== undefined) {
      where.isApproved = isApproved;
    }

    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: "insensitive" } },
        {
          user: {
            OR: [
              { email: { contains: search, mode: "insensitive" } },
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    const [providers, total] = await Promise.all([
      this.prisma.provider.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          _count: {
            select: {
              services: true,
              bookings: true,
              quotes: true,
            },
          },
        },
      }),
      this.prisma.provider.count({ where }),
    ]);

    return {
      data: providers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async approveProvider(id: string, approved: boolean) {
    const provider = await this.prisma.provider.findUnique({
      where: { id },
    });

    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    return this.prisma.provider.update({
      where: { id },
      data: { isApproved: approved },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  // ==================== Category Management ====================

  async getCategories() {
    return this.prisma.category.findMany({
      orderBy: { nameDe: "asc" },
      include: {
        _count: {
          select: {
            services: true,
            serviceRequests: true,
          },
        },
      },
    });
  }

  async createCategory(data: {
    slug: string;
    nameDe: string;
    nameEn: string;
    icon: string;
    parentId?: string;
  }) {
    return this.prisma.category.create({
      data,
    });
  }

  async updateCategory(
    id: string,
    data: {
      nameDe?: string;
      nameEn?: string;
      icon?: string;
      isActive?: boolean;
    }
  ) {
    return this.prisma.category.update({
      where: { id },
      data,
    });
  }

  async deleteCategory(id: string) {
    // Check if category has services or requests
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            services: true,
            serviceRequests: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException("Category not found");
    }

    if (category._count.services > 0 || category._count.serviceRequests > 0) {
      throw new ForbiddenException(
        "Cannot delete category with existing services or requests"
      );
    }

    return this.prisma.category.delete({
      where: { id },
    });
  }

  // ==================== Reports ====================

  async getRevenueReport(startDate: Date, endDate: Date) {
    const bookings = await this.prisma.booking.findMany({
      where: {
        completedAt: {
          gte: startDate,
          lte: endDate,
        },
        paymentStatus: "paid",
      },
      select: {
        completedAt: true,
        totalPrice: true,
      },
      orderBy: { completedAt: "asc" },
    });

    // Group by day
    const dailyRevenue = bookings.reduce(
      (acc, booking) => {
        const date = booking.completedAt!.toISOString().split("T")[0];
        acc[date] = (acc[date] || 0) + booking.totalPrice;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalRevenue: bookings.reduce((sum, b) => sum + b.totalPrice, 0),
      bookingsCount: bookings.length,
      dailyRevenue: Object.entries(dailyRevenue).map(([date, revenue]) => ({
        date,
        revenue,
      })),
    };
  }

  async getCategoryReport() {
    const categories = await this.prisma.category.findMany({
      include: {
        _count: {
          select: {
            services: true,
            serviceRequests: true,
          },
        },
        serviceRequests: {
          where: { status: "completed" },
          select: { id: true },
        },
      },
    });

    return categories.map((cat) => ({
      id: cat.id,
      name: cat.nameDe,
      icon: cat.icon,
      totalServices: cat._count.services,
      totalRequests: cat._count.serviceRequests,
      completedRequests: cat.serviceRequests.length,
    }));
  }

  async getTopProviders(limit = 10) {
    return this.prisma.provider.findMany({
      where: { isApproved: true },
      orderBy: [{ ratingAvg: "desc" }, { totalReviews: "desc" }],
      take: limit,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            profileImage: true,
          },
        },
        _count: {
          select: {
            bookings: true,
          },
        },
      },
    });
  }
}
