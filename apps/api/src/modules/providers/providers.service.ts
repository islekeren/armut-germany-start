import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import {
  CreateProviderDto,
  UpdateProviderDto,
  UpdateOwnProviderProfileDto,
  ProviderOpeningHourDto,
  ProviderQueryDto,
} from "./dto/provider.dto";

@Injectable()
export class ProvidersService {
  constructor(private prisma: PrismaService) {}

  private sanitizeStringArray(values?: string[]) {
    if (!values?.length) return [];

    return values
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  private getDefaultOpeningHours() {
    return [
      { day: "monday", closed: false, open: "08:00", close: "18:00" },
      { day: "tuesday", closed: false, open: "08:00", close: "18:00" },
      { day: "wednesday", closed: false, open: "08:00", close: "18:00" },
      { day: "thursday", closed: false, open: "08:00", close: "18:00" },
      { day: "friday", closed: false, open: "08:00", close: "18:00" },
      { day: "saturday", closed: true },
      { day: "sunday", closed: true },
    ];
  }

  private normalizeOpeningHours(openingHours?: ProviderOpeningHourDto[]) {
    if (!openingHours?.length) {
      return this.getDefaultOpeningHours();
    }

    return openingHours.map((entry) => ({
      day: entry.day,
      closed: !!entry.closed,
      open: entry.closed ? null : entry.open || null,
      close: entry.closed ? null : entry.close || null,
    }));
  }

  private normalizeProfileSlug(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  private async generateUniqueProfileSlug(label: string, providerId?: string) {
    const base = this.normalizeProfileSlug(label) || "provider";
    let slug = base;
    let suffix = 1;

    while (true) {
      const existing = await this.prisma.providerProfile.findUnique({
        where: { slug },
        select: { providerId: true },
      });

      if (!existing || existing.providerId === providerId) {
        return slug;
      }

      slug = `${base}-${suffix}`;
      suffix += 1;
    }
  }

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

    const {
      categories,
      priceMin,
      priceMax,
      headline,
      bio,
      addressLine1,
      city,
      postalCode,
      website,
      galleryImages,
      highlights,
      languages,
      openingHours,
      ...providerData
    } = createProviderDto;

    const hasPriceRange = priceMin !== undefined || priceMax !== undefined;
    let servicesData: Array<{
      categoryId: string;
      title: string;
      description: string;
      priceType: "fixed" | "hourly" | "quote";
      priceMin: number | null;
      priceMax: number | null;
      images: string[];
    }> = [];

    if (categories?.length) {
      const categoryRecords = await this.prisma.category.findMany({
        where: { slug: { in: categories } },
      });

      servicesData = categoryRecords.map((category) => ({
        categoryId: category.id,
        title: category.nameEn,
        description: providerData.description,
        priceType: hasPriceRange ? "hourly" : "quote",
        priceMin: priceMin ?? null,
        priceMax: priceMax ?? null,
        images: [],
      }));
    }

    const slugLabel =
      providerData.companyName ||
      `${user.firstName} ${user.lastName}` ||
      user.email;
    const profileSlug = await this.generateUniqueProfileSlug(slugLabel);

    return this.prisma.provider.create({
      data: {
        userId,
        ...providerData,
        profile: {
          create: {
            slug: profileSlug,
            headline: headline || null,
            bio: bio || providerData.description,
            addressLine1: addressLine1 || null,
            city: city || null,
            postalCode: postalCode || null,
            website: website || null,
            galleryImages: this.sanitizeStringArray(galleryImages),
            highlights: this.sanitizeStringArray(highlights),
            languages: this.sanitizeStringArray(languages),
            openingHours: this.normalizeOpeningHours(openingHours),
          },
        },
        services: servicesData.length ? { create: servicesData } : undefined,
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
        profile: true,
        services: {
          include: {
            category: true,
          },
        },
      },
    });
  }

  async findAll(query: ProviderQueryDto) {
    const {
      lat,
      lng,
      radius,
      categoryId,
      minRating,
      page = 1,
      limit = 10,
    } = query;
    const skip = (page - 1) * limit;
    const hasDistanceFilter =
      lat !== undefined && lng !== undefined && radius !== undefined;

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

    const providerInclude = {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profileImage: true,
        },
      },
      profile: {
        select: {
          slug: true,
          headline: true,
          city: true,
        },
      },
      services: {
        where: { isActive: true },
        include: {
          category: true,
        },
      },
    };

    if (hasDistanceFilter) {
      const boundingBox = this.getBoundingBox(lat, lng, radius);

      const providers = await this.prisma.provider.findMany({
        where: {
          ...where,
          serviceAreaLat: {
            gte: boundingBox.minLat,
            lte: boundingBox.maxLat,
          },
          serviceAreaLng: {
            gte: boundingBox.minLng,
            lte: boundingBox.maxLng,
          },
        },
        orderBy: { ratingAvg: "desc" },
        include: providerInclude,
      });

      const filteredProviders = providers.filter((provider) => {
        const distance = this.calculateDistance(
          lat,
          lng,
          provider.serviceAreaLat,
          provider.serviceAreaLng,
        );
        return distance <= radius;
      });

      const paginatedProviders = filteredProviders.slice(skip, skip + limit);
      const total = filteredProviders.length;

      return {
        data: paginatedProviders,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    const [providers, total] = await Promise.all([
      this.prisma.provider.findMany({
        where,
        skip,
        take: limit,
        orderBy: { ratingAvg: "desc" },
        include: providerInclude,
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

  private getBoundingBox(lat: number, lng: number, radiusKm: number) {
    const latDelta = radiusKm / 111;
    const lngDelta =
      radiusKm / (111 * Math.max(Math.cos(this.toRad(lat)), 0.01));

    return {
      minLat: lat - latDelta,
      maxLat: lat + latDelta,
      minLng: lng - lngDelta,
      maxLng: lng + lngDelta,
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
        profile: true,
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
        profile: true,
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

    if (!provider.profile) {
      const slugLabel =
        provider.companyName ||
        `${provider.user.firstName} ${provider.user.lastName}`.trim() ||
        provider.user.email;
      const slug = await this.generateUniqueProfileSlug(slugLabel, provider.id);

      await this.prisma.providerProfile.create({
        data: {
          providerId: provider.id,
          slug,
          bio: provider.description,
          openingHours: this.getDefaultOpeningHours(),
        },
      });

      return this.findByUserId(userId);
    }

    return provider;
  }

  async update(
    id: string,
    userId: string,
    updateProviderDto: UpdateProviderDto,
  ) {
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
        profile: true,
        services: {
          include: {
            category: true,
          },
        },
      },
    });
  }

  async updateMyProfile(
    userId: string,
    updateDto: UpdateOwnProviderProfileDto,
  ) {
    const provider = await this.prisma.provider.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        profile: true,
      },
    });

    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      priceMin,
      priceMax,
      headline,
      bio,
      addressLine1,
      city,
      postalCode,
      website,
      coverImage,
      phoneVisible,
      galleryImages,
      highlights,
      languages,
      openingHours,
      ...providerData
    } = updateDto;

    const normalizeOptionalText = (value?: string) => {
      if (value === undefined) return undefined;
      const normalized = value.trim();
      return normalized.length ? normalized : null;
    };
    const normalizeUserText = (value?: string) => {
      if (value === undefined) return undefined;
      const normalized = value.trim();
      return normalized.length ? normalized : undefined;
    };

    const profileUpdateData: any = {};
    const normalizedFirstName = normalizeUserText(firstName);
    const normalizedLastName = normalizeUserText(lastName);
    const normalizedEmail = normalizeUserText(email)?.toLowerCase();
    const normalizedPhone = normalizeUserText(phone);
    const normalizedHeadline = normalizeOptionalText(headline);
    const normalizedBio = normalizeOptionalText(bio);
    const normalizedAddress = normalizeOptionalText(addressLine1);
    const normalizedCity = normalizeOptionalText(city);
    const normalizedPostalCode = normalizeOptionalText(postalCode);
    const normalizedWebsite = normalizeOptionalText(website);
    const normalizedCoverImage = normalizeOptionalText(coverImage);

    if (normalizedHeadline !== undefined)
      profileUpdateData.headline = normalizedHeadline;
    if (normalizedBio !== undefined) profileUpdateData.bio = normalizedBio;
    if (normalizedAddress !== undefined)
      profileUpdateData.addressLine1 = normalizedAddress;
    if (normalizedCity !== undefined) profileUpdateData.city = normalizedCity;
    if (normalizedPostalCode !== undefined)
      profileUpdateData.postalCode = normalizedPostalCode;
    if (normalizedWebsite !== undefined)
      profileUpdateData.website = normalizedWebsite;
    if (normalizedCoverImage !== undefined)
      profileUpdateData.coverImage = normalizedCoverImage;
    if (phoneVisible !== undefined)
      profileUpdateData.phoneVisible = phoneVisible;
    if (galleryImages !== undefined) {
      profileUpdateData.galleryImages = this.sanitizeStringArray(galleryImages);
    }
    if (highlights !== undefined) {
      profileUpdateData.highlights = this.sanitizeStringArray(highlights);
    }
    if (languages !== undefined) {
      profileUpdateData.languages = this.sanitizeStringArray(languages);
    }
    if (openingHours !== undefined) {
      profileUpdateData.openingHours = this.normalizeOpeningHours(openingHours);
    }

    if (normalizedEmail && normalizedEmail !== provider.user.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });

      if (existingUser && existingUser.id !== userId) {
        throw new ConflictException("Email already registered");
      }
    }

    const userUpdateData: any = {};
    if (normalizedFirstName !== undefined) {
      userUpdateData.firstName = normalizedFirstName;
    }
    if (normalizedLastName !== undefined) {
      userUpdateData.lastName = normalizedLastName;
    }
    if (normalizedEmail !== undefined) {
      userUpdateData.email = normalizedEmail;
    }
    if (normalizedPhone !== undefined) {
      userUpdateData.phone = normalizedPhone;
    }

    const servicePriceData: any = {};
    if (priceMin !== undefined) servicePriceData.priceMin = priceMin;
    if (priceMax !== undefined) servicePriceData.priceMax = priceMax;

    const shouldMutateProfile =
      !provider.profile || Object.keys(profileUpdateData).length > 0;

    let profileMutation: any;
    if (shouldMutateProfile) {
      const slugLabel =
        providerData.companyName ||
        provider.companyName ||
        `${normalizedFirstName ?? provider.user.firstName} ${
          normalizedLastName ?? provider.user.lastName
        }`.trim() ||
        normalizedEmail ||
        provider.user.email;
      const slug = await this.generateUniqueProfileSlug(slugLabel, provider.id);

      profileMutation = {
        upsert: {
          create: {
            slug,
            headline: normalizedHeadline ?? null,
            bio: normalizedBio ?? provider.description,
            addressLine1: normalizedAddress ?? null,
            city: normalizedCity ?? null,
            postalCode: normalizedPostalCode ?? null,
            website: normalizedWebsite ?? null,
            coverImage: normalizedCoverImage ?? null,
            phoneVisible: phoneVisible ?? true,
            galleryImages: this.sanitizeStringArray(galleryImages),
            highlights: this.sanitizeStringArray(highlights),
            languages: this.sanitizeStringArray(languages),
            openingHours: this.normalizeOpeningHours(openingHours),
          },
          update: profileUpdateData,
        },
      };
    }

    return this.prisma.provider.update({
      where: { id: provider.id },
      data: {
        ...providerData,
        user: Object.keys(userUpdateData).length
          ? {
              update: userUpdateData,
            }
          : undefined,
        profile: profileMutation,
        services: Object.keys(servicePriceData).length
          ? {
              updateMany: {
                where: { isActive: true },
                data: servicePriceData,
              },
            }
          : undefined,
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
        profile: true,
        services: {
          include: {
            category: true,
          },
        },
      },
    });
  }

  async getPublicProfile(providerId: string) {
    const provider = await this.prisma.provider.findFirst({
      where: {
        id: providerId,
        isApproved: true,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            profileImage: true,
          },
        },
        profile: true,
        services: {
          where: { isActive: true },
          include: {
            category: true,
          },
        },
      },
    });

    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    const where = { revieweeId: provider.userId };
    const [
      reviews,
      ratingBreakdown,
      completedJobs,
      totalQuotes,
      acceptedQuotes,
    ] = await Promise.all([
      this.prisma.review.findMany({
        where,
        take: 12,
        orderBy: { createdAt: "desc" },
        include: {
          reviewer: {
            select: {
              firstName: true,
              lastName: true,
              profileImage: true,
            },
          },
          booking: {
            include: {
              quote: {
                include: {
                  request: {
                    select: {
                      title: true,
                      category: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.review.groupBy({
        by: ["rating"],
        where,
        _count: { rating: true },
      }),
      this.prisma.booking.count({
        where: { providerId: provider.id, status: "completed" },
      }),
      this.prisma.quote.count({
        where: { providerId: provider.id },
      }),
      this.prisma.quote.count({
        where: { providerId: provider.id, status: "accepted" },
      }),
    ]);

    const breakdown: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    ratingBreakdown.forEach((item) => {
      breakdown[item.rating] = item._count.rating;
    });

    const acceptanceRate =
      totalQuotes > 0
        ? Number(((acceptedQuotes / totalQuotes) * 100).toFixed(1))
        : 0;

    return {
      id: provider.id,
      userId: provider.userId,
      companyName: provider.companyName,
      description: provider.description,
      experienceYears: provider.experienceYears,
      serviceAreaRadius: provider.serviceAreaRadius,
      serviceAreaLat: provider.serviceAreaLat,
      serviceAreaLng: provider.serviceAreaLng,
      ratingAvg: provider.ratingAvg,
      totalReviews: provider.totalReviews,
      completedJobs,
      acceptanceRate,
      memberSince: provider.createdAt,
      user: {
        id: provider.user.id,
        firstName: provider.user.firstName,
        lastName: provider.user.lastName,
        phone: provider.profile?.phoneVisible ? provider.user.phone : null,
        profileImage: provider.user.profileImage,
      },
      profile: {
        slug: provider.profile?.slug || null,
        headline: provider.profile?.headline || null,
        bio: provider.profile?.bio || provider.description,
        addressLine1: provider.profile?.addressLine1 || null,
        city: provider.profile?.city || null,
        postalCode: provider.profile?.postalCode || null,
        website: provider.profile?.website || null,
        coverImage: provider.profile?.coverImage || null,
        phoneVisible: provider.profile?.phoneVisible ?? true,
        galleryImages: provider.profile?.galleryImages || [],
        highlights: provider.profile?.highlights || [],
        languages: provider.profile?.languages || [],
        openingHours:
          provider.profile?.openingHours || this.getDefaultOpeningHours(),
      },
      services: provider.services,
      reviews: {
        breakdown,
        items: reviews.map((review) => ({
          id: review.id,
          rating: review.rating,
          comment: review.comment,
          providerReply: review.providerReply,
          images: review.images,
          providerReplyImages: review.providerReplyImages,
          createdAt: review.createdAt,
          reviewer: {
            name: `${review.reviewer.firstName} ${review.reviewer.lastName}`.trim(),
            profileImage: review.reviewer.profileImage,
          },
          service: {
            title: review.booking.quote.request.title,
            category: review.booking.quote.request.category,
          },
        })),
      },
    };
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
          status: { in: ["pending", "confirmed", "in_progress", "completion_pending"] },
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
      conversionRate:
        totalQuotes > 0 ? (acceptedQuotes / totalQuotes) * 100 : 0,
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
          status: { in: ["pending", "confirmed", "in_progress", "completion_pending"] },
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
        budget:
          req.budgetMin && req.budgetMax
            ? `${req.budgetMin}-${req.budgetMax}€`
            : "Custom",
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
    lon2: number,
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

  async getRequests(
    userId: string,
    query: { category?: string; page?: number; limit?: number },
  ) {
    const { category, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const provider = await this.prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    const where: any = {
      status: "open",
      quotes: {
        none: { providerId: provider.id },
      },
    };

    // Optional category filter (independent from provider service categories)
    if (category) {
      const cat = await this.prisma.category.findUnique({
        where: { slug: category },
      });
      if (cat) {
        where.categoryId = cat.id;
      }
    }

    const [requests, total] = await Promise.all([
      this.prisma.serviceRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          category: true,
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              createdAt: true,
            },
          },
        },
      }),
      this.prisma.serviceRequest.count({ where }),
    ]);

    return {
      data: requests.map((req) => ({
        id: req.id,
        title: req.title,
        category: req.category.slug,
        categoryName: req.category.nameEn,
        description: req.description,
        location: `${req.postalCode} ${req.city}`,
        address: req.address,
        preferredDate: req.preferredDate,
        budget:
          req.budgetMin && req.budgetMax
            ? `${req.budgetMin}-${req.budgetMax}€`
            : null,
        budgetMin: req.budgetMin,
        budgetMax: req.budgetMax,
        createdAt: req.createdAt,
        customer: {
          name: `${req.customer.firstName} ${req.customer.lastName.charAt(0)}.`,
          memberSince: new Date(req.customer.createdAt)
            .getFullYear()
            .toString(),
        },
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getBookings(
    userId: string,
    query: { month?: number; year?: number; status?: string },
  ) {
    const { month, year, status } = query;

    const provider = await this.prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    const where: any = {
      providerId: provider.id,
    };

    // Filter by month/year if provided
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      where.scheduledDate = {
        gte: startDate,
        lte: endDate,
      };
    }

    if (status) {
      where.status = status;
    } else {
      // Default: exclude cancelled
      where.status = { not: "cancelled" };
    }

    const bookings = await this.prisma.booking.findMany({
      where,
      orderBy: { scheduledDate: "asc" },
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        quote: {
          include: {
            request: {
              select: {
                title: true,
                address: true,
              },
            },
          },
        },
      },
    });

    return bookings.map((booking) => ({
      id: booking.id,
      title: booking.quote.request.title,
      customer: `${booking.customer.firstName} ${booking.customer.lastName}`,
      date: booking.scheduledDate.toISOString().split("T")[0],
      time: booking.scheduledDate.toTimeString().slice(0, 5),
      scheduledDate: booking.scheduledDate,
      status: booking.status,
      address: booking.quote.request.address,
      totalPrice: booking.totalPrice,
      paymentStatus: booking.paymentStatus,
    }));
  }

  async getReviews(userId: string, query: { page?: number; limit?: number }) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const provider = await this.prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    const where = {
      revieweeId: provider.userId,
    };

    const [reviews, total, ratingBreakdown] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          reviewer: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          booking: {
            include: {
              quote: {
                include: {
                  request: {
                    select: { title: true },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.groupBy({
        by: ["rating"],
        where,
        _count: { rating: true },
      }),
    ]);

    // Build rating breakdown
    const breakdown: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    ratingBreakdown.forEach((r) => {
      breakdown[r.rating] = r._count.rating;
    });

    return {
        data: reviews.map((review) => ({
          id: review.id,
          customer: `${review.reviewer.firstName} ${review.reviewer.lastName}`,
          rating: review.rating,
          date: review.createdAt,
          service: review.booking.quote.request.title,
          comment: review.comment,
          reply: review.providerReply,
          images: review.images,
          replyImages: review.providerReplyImages,
        })),
      stats: {
        average: provider.ratingAvg,
        total,
        breakdown,
      },
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async replyToReview(
    userId: string,
    reviewId: string,
    reply: string,
    replyImages?: string[],
  ) {
    const provider = await this.prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException("Review not found");
    }

    if (review.revieweeId !== provider.userId) {
      throw new ForbiddenException("Not authorized to reply to this review");
    }

    return this.prisma.review.update({
      where: { id: reviewId },
      data: {
        providerReply: reply,
        providerReplyImages: this.sanitizeStringArray(replyImages).slice(0, 10),
      },
    });
  }
}
