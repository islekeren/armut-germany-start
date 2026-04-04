import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import {
  CreateRequestDto,
  UpdateRequestDto,
  RequestQueryDto,
} from "./dto/request.dto";
import { NotificationsService } from "../notifications/notifications.service";
import {
  getRequestBranchById,
  getRequestBranchesByCategorySlug,
  getRequestSectorById,
} from "../../common/request-taxonomy";
import { getCanonicalCategorySlug } from "@repo/shared";

@Injectable()
export class RequestsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  // Helper to check if a string is a valid UUID
  private isUUID(str: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  async create(
    customerId: string,
    createRequestDto: CreateRequestDto,
    userType: "customer" | "provider" | "admin" = "customer",
  ) {
    if (userType !== "customer") {
      throw new ForbiddenException(
        "Only customers can create service requests",
      );
    }

    // Look up category by ID or slug.
    let category;
    if (this.isUUID(createRequestDto.categoryId)) {
      category = await this.prisma.category.findUnique({
        where: { id: createRequestDto.categoryId },
      });
    } else {
      const canonicalCategorySlug =
        getCanonicalCategorySlug(createRequestDto.categoryId) ||
        createRequestDto.categoryId;
      // Assume it's a slug
      category = await this.prisma.category.findUnique({
        where: { slug: canonicalCategorySlug },
      });
    }

    if (!category || !category.isActive) {
      throw new NotFoundException("Category not found");
    }

    const branch = getRequestBranchById(createRequestDto.requestBranch);
    if (createRequestDto.requestBranch && !branch) {
      throw new BadRequestException("Invalid request branch");
    }

    const sector = getRequestSectorById(createRequestDto.requestSector);
    if (createRequestDto.requestSector && !sector) {
      throw new BadRequestException("Invalid request sector");
    }

    if (branch && branch.categorySlug !== category.slug) {
      throw new BadRequestException("Request branch does not match category");
    }

    if (branch && sector && branch.sectorId !== sector.id) {
      throw new BadRequestException(
        "Request sector does not match request branch",
      );
    }

    const matchingBranches = getRequestBranchesByCategorySlug(category.slug);
    if (
      !branch &&
      sector &&
      !matchingBranches.some((item) => item.sectorId === sector.id)
    ) {
      throw new BadRequestException("Request sector does not match category");
    }

    const uniqueBranch =
      matchingBranches.length === 1 ? matchingBranches[0] : null;
    const uniqueSectorId = [
      ...new Set(matchingBranches.map((item) => item.sectorId)),
    ];
    const fallbackSector =
      uniqueSectorId.length === 1
        ? getRequestSectorById(uniqueSectorId[0])
        : null;

    const normalizedBranch = branch || uniqueBranch;
    const normalizedSector =
      sector ||
      getRequestSectorById(normalizedBranch?.sectorId) ||
      fallbackSector;

    const {
      categoryId: _categoryId,
      preferredDate,
      requestSector: _requestSector,
      requestBranch: _requestBranch,
      ...requestData
    } = createRequestDto;

    return this.prisma.serviceRequest.create({
      data: {
        customerId,
        ...requestData,
        categoryId: category.id,
        requestSector: normalizedSector?.id || null,
        requestBranch: normalizedBranch?.id || null,
        preferredDate: preferredDate ? new Date(preferredDate) : null,
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
          },
        },
        category: true,
        quotes: {
          include: {
            provider: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    profileImage: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async findAll(query: RequestQueryDto) {
    const {
      categoryId,
      postalCode,
      lat,
      lng,
      radius,
      status,
      page = 1,
      limit = 10,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      status: status || "open",
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (postalCode) {
      where.postalCode = { startsWith: postalCode.substring(0, 2) };
    }

    let requests = await this.prisma.serviceRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
          },
        },
        category: true,
        _count: {
          select: { quotes: true },
        },
      },
    });

    // Filter by distance if lat/lng provided
    if (lat && lng && radius) {
      requests = requests.filter((request) => {
        const distance = this.calculateDistance(
          lat,
          lng,
          request.lat,
          request.lng,
        );
        return distance <= radius;
      });
    }

    const total = await this.prisma.serviceRequest.count({ where });

    return {
      data: requests,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByCustomer(customerId: string, status?: string) {
    const where: any = { customerId };
    if (status) {
      where.status = status;
    }

    return this.prisma.serviceRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        category: true,
        _count: {
          select: { quotes: true },
        },
        quotes: {
          where: { status: "pending" },
          take: 1,
        },
      },
    });
  }

  async findOne(id: string) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
            createdAt: true,
          },
        },
        category: true,
        quotes: {
          orderBy: { createdAt: "desc" },
          include: {
            provider: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    profileImage: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException("Service request not found");
    }

    return request;
  }

  async update(id: string, userId: string, updateRequestDto: UpdateRequestDto) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException("Service request not found");
    }

    if (request.customerId !== userId) {
      throw new ForbiddenException("Not authorized to update this request");
    }

    return this.prisma.serviceRequest.update({
      where: { id },
      data: {
        ...updateRequestDto,
        preferredDate: updateRequestDto.preferredDate
          ? new Date(updateRequestDto.preferredDate)
          : undefined,
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        category: true,
      },
    });
  }

  async cancel(id: string, userId: string) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        quotes: {
          select: {
            provider: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException("Service request not found");
    }

    if (request.customerId !== userId) {
      throw new ForbiddenException("Not authorized to cancel this request");
    }

    if (request.status !== "open") {
      throw new ForbiddenException("Can only cancel open requests");
    }

    const cancelledRequest = await this.prisma.serviceRequest.update({
      where: { id },
      data: { status: "cancelled" },
    });

    const providerUserIds: string[] = [];
    for (const quote of request.quotes ?? []) {
      const providerUserId = quote.provider?.userId;
      if (
        typeof providerUserId === "string" &&
        providerUserId.length > 0 &&
        !providerUserIds.includes(providerUserId)
      ) {
        providerUserIds.push(providerUserId);
      }
    }

    await Promise.all([
      this.notificationsService.create(userId, {
        type: "request_cancelled",
        title: "Request cancelled",
        message: `Your request "${request.title}" has been cancelled.`,
        metadata: { requestId: request.id },
      }),
      ...providerUserIds.map((providerUserId) =>
        this.notificationsService.create(providerUserId, {
          type: "request_cancelled",
          title: "Request cancelled",
          message: `A customer cancelled the request "${request.title}".`,
          metadata: { requestId: request.id },
        }),
      ),
    ]);

    return cancelledRequest;
  }

  async getForProvider(providerId: string, query: RequestQueryDto) {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      include: {
        services: {
          select: { categoryId: true },
        },
      },
    });

    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    const categoryIds = provider.services.map((s) => s.categoryId);
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      status: "open",
      categoryId: { in: categoryIds },
      // Exclude requests already quoted by this provider
      quotes: {
        none: {
          providerId: provider.id,
        },
      },
    };

    let requests = await this.prisma.serviceRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            createdAt: true,
          },
        },
        category: true,
        _count: {
          select: { quotes: true },
        },
      },
    });

    // Filter by provider's service area
    requests = requests.filter((request) => {
      const distance = this.calculateDistance(
        provider.serviceAreaLat,
        provider.serviceAreaLng,
        request.lat,
        request.lng,
      );
      return distance <= provider.serviceAreaRadius;
    });

    const total = requests.length;

    return {
      data: requests,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371;
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
