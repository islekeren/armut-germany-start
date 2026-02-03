import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateProviderDto, UpdateProviderDto, ProviderQueryDto } from "./dto/provider.dto";

@Injectable()
export class ProvidersService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createProviderDto: CreateProviderDto) {
    // Check if user already has a provider profile
    const existingProvider = await this.prisma.provider.findUnique({
      where: { userId },
    });

    if (existingProvider) {
      throw new ConflictException("User already has a provider profile");
    }

    // Check if user is a provider type
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.userType !== "provider") {
      throw new ForbiddenException("User must be registered as a provider");
    }

    return this.prisma.provider.create({
      data: {
        userId,
        ...createProviderDto,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            profileImage: true,
          },
        },
        services: true,
      },
    });
  }

  async findAll(query: ProviderQueryDto) {
    const { lat, lng, radius, categoryId, minRating, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      isApproved: true,
    };

    if (minRating) {
      where.ratingAvg = { gte: minRating };
    }

    if (categoryId) {
      where.services = {
        some: {
          categoryId,
          isActive: true,
        },
      };
    }

    const providers = await this.prisma.provider.findMany({
      where,
      skip,
      take: limit,
      orderBy: { ratingAvg: "desc" },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
          },
        },
        services: {
          where: { isActive: true },
          include: {
            category: true,
          },
        },
      },
    });

    // Filter by distance if lat/lng provided
    let filteredProviders = providers;
    if (lat && lng && radius) {
      filteredProviders = providers.filter((provider) => {
        const distance = this.calculateDistance(
          lat,
          lng,
          provider.serviceAreaLat,
          provider.serviceAreaLng
        );
        return distance <= radius;
      });
    }

    const total = await this.prisma.provider.count({ where });

    return {
      data: filteredProviders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            profileImage: true,
          },
        },
        services: {
          where: { isActive: true },
          include: {
            category: true,
          },
        },
        bookings: {
          where: { status: "completed" },
          include: {
            review: true,
          },
          take: 10,
          orderBy: { completedAt: "desc" },
        },
      },
    });

    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    return provider;
  }

  async findByUserId(userId: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            profileImage: true,
          },
        },
        services: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!provider) {
      throw new NotFoundException("Provider profile not found");
    }

    return provider;
  }

  async update(id: string, userId: string, updateProviderDto: UpdateProviderDto) {
    const provider = await this.prisma.provider.findUnique({
      where: { id },
    });

    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    if (provider.userId !== userId) {
      throw new ForbiddenException("Not authorized to update this provider");
    }

    return this.prisma.provider.update({
      where: { id },
      data: updateProviderDto,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            profileImage: true,
          },
        },
        services: true,
      },
    });
  }

  async approve(id: string, isApproved: boolean) {
    const provider = await this.prisma.provider.findUnique({
      where: { id },
    });

    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    return this.prisma.provider.update({
      where: { id },
      data: { isApproved },
    });
  }

  async getStats(userId: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    const [
      totalQuotes,
      acceptedQuotes,
      activeBookings,
      completedBookings,
      totalEarnings,
    ] = await Promise.all([
      this.prisma.quote.count({ where: { providerId: provider.id } }),
      this.prisma.quote.count({
        where: { providerId: provider.id, status: "accepted" },
      }),
      this.prisma.booking.count({
        where: {
          providerId: provider.id,
          status: { in: ["pending", "confirmed", "in_progress"] },
        },
      }),
      this.prisma.booking.count({
        where: { providerId: provider.id, status: "completed" },
      }),
      this.prisma.booking.aggregate({
        where: {
          providerId: provider.id,
          status: "completed",
          paymentStatus: "paid",
        },
        _sum: { totalPrice: true },
      }),
    ]);

    return {
      totalQuotes,
      acceptedQuotes,
      conversionRate: totalQuotes > 0 ? (acceptedQuotes / totalQuotes) * 100 : 0,
      activeBookings,
      completedBookings,
      totalEarnings: totalEarnings._sum.totalPrice || 0,
      rating: provider.ratingAvg,
      totalReviews: provider.totalReviews,
    };
  }

  async getDashboard(userId: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { userId },
      include: {
        services: {
          where: { isActive: true },
          select: { categoryId: true },
        },
      },
    });

    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    const categoryIds = provider.services.map((s) => s.categoryId);

    const [
      newRequestsCount,
      activeOrdersCount,
      completedCount,
      recentRequests,
      activeBookings,
    ] = await Promise.all([
      // New Requests (Open requests in provider's categories)
      this.prisma.serviceRequest.count({
        where: {
          status: "open",
          categoryId: { in: categoryIds },
          quotes: {
            none: { providerId: provider.id }, // Exclude requests already quoted by me
          },
        },
      }),
      // Active Orders
      this.prisma.booking.count({
        where: {
          providerId: provider.id,
          status: { in: ["pending", "confirmed", "in_progress"] },
        },
      }),
      // Completed Orders
      this.prisma.booking.count({
        where: {
          providerId: provider.id,
          status: "completed",
        },
      }),
      // Recent Requests List
      this.prisma.serviceRequest.findMany({
        where: {
          status: "open",
          categoryId: { in: categoryIds },
          quotes: {
            none: { providerId: provider.id },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 3,
        include: {
          category: true,
        },
      }),
      // Active Bookings List
      this.prisma.booking.findMany({
        where: {
          providerId: provider.id,
          status: { in: ["pending", "confirmed", "in_progress"] },
        },
        orderBy: { scheduledDate: "asc" },
        take: 3,
        include: {
          customer: {
            select: { firstName: true, lastName: true },
          },
          quote: {
            include: {
              request: {
                include: { category: true },
              },
            },
          },
        },
      }),
    ]);

    return {
      stats: {
        newRequests: newRequestsCount,
        activeOrders: activeOrdersCount,
        completed: completedCount,
        rating: provider.ratingAvg,
      },
      recentRequests: recentRequests.map((req) => ({
        id: req.id,
        title: req.title,
        category: req.category.nameEn, // Or nameDe based on locale, but using EN for now
        location: `${req.postalCode} ${req.city}`,
        date: req.createdAt,
        budget: req.budgetMin && req.budgetMax ? `${req.budgetMin}-${req.budgetMax}€` : "Custom",
      })),
      activeBookings: activeBookings.map((booking) => ({
        id: booking.id,
        customer: `${booking.customer.firstName} ${booking.customer.lastName}`,
        service: booking.quote.request.category.nameEn,
        date: booking.scheduledDate,
        time: booking.scheduledDate, // Frontend will format this
        status: booking.status,
      })),
    };
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
