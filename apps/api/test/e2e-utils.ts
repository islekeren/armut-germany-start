import { type INestApplication } from "@nestjs/common";
import { Test, type TestingModuleBuilder } from "@nestjs/testing";
import {
  PrismaClient,
  type BookingStatus,
  type QuoteStatus,
  type RequestStatus,
  type UserType,
} from "@prisma/client";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import {
  REQUEST_BRANCHES,
  REQUEST_SECTORS,
} from "../src/common/request-taxonomy";

const TEST_PASSWORD = "Password123!";
const DAY_MS = 24 * 60 * 60 * 1000;

export const prisma = new PrismaClient();

/** ISO timestamp `days` from now; quotes and bookings must be future-dated. */
export const daysFromNow = (days: number) =>
  new Date(Date.now() + days * DAY_MS).toISOString();

/**
 * Boots the full AppModule with the same HTTP configuration as `main.ts`.
 * Pass `override` to swap providers (e.g. a mocked PrismaService).
 */
export async function createTestApp(
  override?: (builder: TestingModuleBuilder) => TestingModuleBuilder,
): Promise<INestApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (override) {
    builder = override(builder);
  }
  const moduleFixture = await builder.compile();

  const app = moduleFixture.createNestApplication();
  configureApp(app);
  await app.init();

  return app;
}

export async function closeTestApp(app?: INestApplication) {
  if (app) {
    await app.close();
  }
}

export async function resetDatabase() {
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.review.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.serviceRequest.deleteMany();
  await prisma.service.deleteMany();
  await prisma.providerProfile.deleteMany();
  await prisma.provider.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
}

export async function seedTaxonomyCategories() {
  const sectorMap = new Map<string, string>();

  for (const sector of REQUEST_SECTORS) {
    const created = await prisma.category.create({
      data: {
        slug: sector.id,
        nameDe: sector.labelDe,
        nameEn: sector.labelEn,
        icon: sector.icon,
        isActive: sector.isActive,
      },
    });
    sectorMap.set(sector.id, created.id);
  }

  for (const branch of REQUEST_BRANCHES) {
    await prisma.category.create({
      data: {
        slug: branch.categorySlug,
        nameDe: branch.labelDe,
        nameEn: branch.labelEn,
        icon: branch.icon,
        isActive: branch.isActive,
        parentId: sectorMap.get(branch.sectorId) ?? null,
      },
    });
  }
}

export async function resetAndSeedDatabase() {
  await resetDatabase();
  await seedTaxonomyCategories();
}

async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function createUserFixture(input: {
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  userType?: UserType;
  phone?: string;
}) {
  const password = input.password ?? TEST_PASSWORD;
  const user = await prisma.user.create({
    data: {
      email: input.email,
      password: await hashPassword(password),
      firstName: input.firstName ?? "Test",
      lastName: input.lastName ?? "User",
      phone: input.phone,
      userType: input.userType ?? "customer",
      isVerified: true,
      gdprConsent: true,
    },
  });

  return { user, password };
}

export async function getCategoryBySlug(slug: string) {
  return prisma.category.findUniqueOrThrow({
    where: { slug },
  });
}

export async function createProviderFixture(input: {
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  description?: string;
  categories?: string[];
  withProfile?: boolean;
  isApproved?: boolean;
}) {
  const { user, password } = await createUserFixture({
    email: input.email,
    password: input.password,
    firstName: input.firstName ?? "Provider",
    lastName: input.lastName ?? "User",
    userType: "provider",
    phone: "+49123456789",
  });

  const provider = await prisma.provider.create({
    data: {
      userId: user.id,
      companyName: input.companyName ?? "Spark Clean",
      description: input.description ?? "Reliable local service provider.",
      experienceYears: 6,
      serviceAreaLat: 52.52,
      serviceAreaLng: 13.405,
      serviceAreaRadius: 25,
      isApproved: input.isApproved ?? true,
      documents: [],
    },
  });

  for (const slug of input.categories ?? ["home-cleaning"]) {
    const category = await getCategoryBySlug(slug);
    await prisma.service.create({
      data: {
        providerId: provider.id,
        categoryId: category.id,
        title: category.nameEn,
        description: input.description ?? "Reliable local service provider.",
        priceType: "hourly",
        priceMin: 40,
        priceMax: 65,
        images: [],
      },
    });
  }

  if (input.withProfile ?? true) {
    await prisma.providerProfile.create({
      data: {
        providerId: provider.id,
        slug: `${provider.id.slice(0, 8)}-${(input.companyName ?? "spark-clean").toLowerCase()}`,
        bio: input.description ?? "Reliable local service provider.",
        city: "Berlin",
        postalCode: "10115",
        phoneVisible: true,
        galleryImages: [],
        highlights: ["Fast response"],
        languages: ["German", "English"],
        openingHours: [
          { day: "monday", closed: false, open: "08:00", close: "17:00" },
        ],
      },
    });
  }

  return { user, provider, password };
}

export async function createCompletedReviewFixture(input: {
  customerId: string;
  providerId: string;
  providerUserId: string;
  categorySlug?: string;
  rating?: number;
  title?: string;
}) {
  const category = await getCategoryBySlug(
    input.categorySlug ?? "home-cleaning",
  );
  const serviceRequest = await prisma.serviceRequest.create({
    data: {
      customerId: input.customerId,
      categoryId: category.id,
      requestSector: "cleaning-care",
      requestBranch: input.categorySlug ?? "home-cleaning",
      title: input.title ?? "Deep cleaning for move-out",
      description: "A completed job used for provider review coverage.",
      address: "Torstrasse 1",
      city: "Berlin",
      postalCode: "10115",
      lat: 52.52,
      lng: 13.405,
      status: "completed",
      images: [],
    },
  });

  const quote = await prisma.quote.create({
    data: {
      requestId: serviceRequest.id,
      providerId: input.providerId,
      customerId: input.customerId,
      price: 180,
      message: "Happy to help.",
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: "accepted",
    },
  });

  const booking = await prisma.booking.create({
    data: {
      quoteId: quote.id,
      customerId: input.customerId,
      providerId: input.providerId,
      scheduledDate: new Date("2026-04-01T10:00:00.000Z"),
      status: "completed",
      totalPrice: 180,
      paymentStatus: "paid",
      completedAt: new Date("2026-04-01T14:00:00.000Z"),
    },
  });

  const review = await prisma.review.create({
    data: {
      bookingId: booking.id,
      reviewerId: input.customerId,
      revieweeId: input.providerUserId,
      rating: input.rating ?? 5,
      comment: "Excellent work and clear communication.",
      images: ["https://example.com/review-photo.png"],
    },
  });

  await prisma.provider.update({
    where: { id: input.providerId },
    data: {
      ratingAvg: input.rating ?? 5,
      totalReviews: 1,
    },
  });

  return { serviceRequest, quote, booking, review };
}

export async function loginAs(
  app: INestApplication,
  email: string,
  password = TEST_PASSWORD,
) {
  const response = await request(app.getHttpServer())
    .post("/api/auth/login")
    .send({ email, password })
    .expect(201);

  return response.body as {
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string };
  };
}

export function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function createAdminFixture(input: {
  email: string;
  password?: string;
}) {
  return createUserFixture({
    email: input.email,
    password: input.password,
    firstName: "Ada",
    lastName: "Admin",
    userType: "admin",
  });
}

export async function createRequestFixture(input: {
  customerId: string;
  categorySlug?: string;
  title?: string;
  status?: RequestStatus;
  budgetMin?: number;
  budgetMax?: number;
}) {
  const categorySlug = input.categorySlug ?? "home-cleaning";
  const category = await getCategoryBySlug(categorySlug);
  const branch = REQUEST_BRANCHES.find((b) => b.categorySlug === categorySlug);

  return prisma.serviceRequest.create({
    data: {
      customerId: input.customerId,
      categoryId: category.id,
      requestSector: branch?.sectorId ?? null,
      requestBranch: branch?.id ?? null,
      title: input.title ?? "Apartment cleaning",
      description: "Fixture request created directly in the database.",
      address: "Torstrasse 1",
      city: "Berlin",
      postalCode: "10115",
      lat: 52.52,
      lng: 13.405,
      budgetMin: input.budgetMin ?? 100,
      budgetMax: input.budgetMax ?? 200,
      status: input.status ?? "open",
      images: [],
    },
  });
}

export async function createQuoteFixture(input: {
  requestId: string;
  providerId: string;
  customerId: string;
  price?: number;
  status?: QuoteStatus;
  validUntil?: string;
}) {
  return prisma.quote.create({
    data: {
      requestId: input.requestId,
      providerId: input.providerId,
      customerId: input.customerId,
      price: input.price ?? 150,
      message: "Fixture quote.",
      validUntil: input.validUntil ?? daysFromNow(7),
      status: input.status ?? "pending",
    },
  });
}

export async function createBookingFixture(input: {
  quoteId: string;
  customerId: string;
  providerId: string;
  status?: BookingStatus;
  totalPrice?: number;
  scheduledDate?: string;
}) {
  return prisma.booking.create({
    data: {
      quoteId: input.quoteId,
      customerId: input.customerId,
      providerId: input.providerId,
      scheduledDate: input.scheduledDate ?? daysFromNow(3),
      status: input.status ?? "pending",
      totalPrice: input.totalPrice ?? 150,
    },
  });
}

/**
 * Builds the common marketplace state in one call: an open request by the
 * customer and a quote on it from the provider (pending unless overridden),
 * plus a booking when `bookingStatus` is given.
 */
export async function createDealFixture(input: {
  customerId: string;
  providerId: string;
  quoteStatus?: QuoteStatus;
  bookingStatus?: BookingStatus;
  requestStatus?: RequestStatus;
}) {
  const serviceRequest = await createRequestFixture({
    customerId: input.customerId,
    status: input.requestStatus,
  });
  const quote = await createQuoteFixture({
    requestId: serviceRequest.id,
    providerId: input.providerId,
    customerId: input.customerId,
    status: input.quoteStatus ?? (input.bookingStatus ? "accepted" : "pending"),
  });
  const booking = input.bookingStatus
    ? await createBookingFixture({
        quoteId: quote.id,
        customerId: input.customerId,
        providerId: input.providerId,
        status: input.bookingStatus,
      })
    : null;

  return { serviceRequest, quote, booking };
}

export async function createConversationFixture(input: {
  participantIds: string[];
  requestId?: string;
  messages?: { senderId: string; content: string }[];
}) {
  const conversation = await prisma.conversation.create({
    data: {
      requestId: input.requestId,
      participants: {
        create: input.participantIds.map((userId) => ({ userId })),
      },
    },
  });

  for (const message of input.messages ?? []) {
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: message.senderId,
        content: message.content,
        attachments: [],
      },
    });
  }

  return conversation;
}

export { TEST_PASSWORD };
