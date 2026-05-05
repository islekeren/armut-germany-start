import { ValidationPipe } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaClient, type UserType } from "@prisma/client";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { REQUEST_BRANCHES, REQUEST_SECTORS } from "../src/common/request-taxonomy";

const TEST_PASSWORD = "Password123!";

export const prisma = new PrismaClient();

export async function createTestApp() {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.setGlobalPrefix("api");
  await app.init();

  return app;
}

export async function closeTestApp(app?: { close: () => Promise<void> }) {
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
  const category = await getCategoryBySlug(input.categorySlug ?? "home-cleaning");
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

export async function loginAs(app: any, email: string, password = TEST_PASSWORD) {
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

export { TEST_PASSWORD };
