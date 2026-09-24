import { randomUUID } from "node:crypto";
import {
  PrismaClient,
  type BookingStatus,
  type QuoteStatus,
  type RequestStatus,
  type UserType,
} from "@prisma/client";
import bcrypt from "bcrypt";

/**
 * Direct database access for arranging browser-test state. The web e2e
 * database is seeded once (taxonomy + demo accounts); every test creates its
 * own uniquely named records on top, so tests never depend on each other.
 */
export const E2E_DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:5433/armut_e2e_web";

export const PASSWORD = "Password123!";
const DAY_MS = 24 * 60 * 60 * 1000;

let client: PrismaClient | undefined;
let passwordHash: Promise<string> | undefined;

export function db() {
  client ??= new PrismaClient({
    datasources: { db: { url: E2E_DATABASE_URL } },
  });
  return client;
}

export async function disconnectDb() {
  await client?.$disconnect();
  client = undefined;
}

export const daysFromNow = (days: number) =>
  new Date(Date.now() + days * DAY_MS);

export function uniqueEmail(label: string) {
  return `${label}.${randomUUID().slice(0, 8)}@e2e.test`;
}

export async function createUser(input: {
  label: string;
  firstName?: string;
  lastName?: string;
  userType?: UserType;
}) {
  passwordHash ??= bcrypt.hash(PASSWORD, 10);
  return db().user.create({
    data: {
      email: uniqueEmail(input.label),
      password: await passwordHash,
      firstName: input.firstName ?? "Casey",
      lastName: input.lastName ?? "Customer",
      userType: input.userType ?? "customer",
      phone: "+49 30 1234567",
      isVerified: true,
      gdprConsent: true,
    },
  });
}

export async function categoryBySlug(slug: string) {
  return db().category.findUniqueOrThrow({ where: { slug } });
}

export async function createProvider(input: {
  label: string;
  companyName?: string;
  categories?: string[];
  isApproved?: boolean;
  /** Rate 5.0 so the provider sorts ahead of seeded ones in paged lists. */
  topRated?: boolean;
}) {
  const user = await createUser({
    label: input.label,
    firstName: "Pat",
    lastName: "Provider",
    userType: "provider",
  });
  const companyName =
    input.companyName ?? `Spark Clean ${randomUUID().slice(0, 4)}`;
  const provider = await db().provider.create({
    data: {
      userId: user.id,
      companyName,
      description: "Reliable local service provider.",
      experienceYears: 6,
      serviceAreaLat: 52.52,
      serviceAreaLng: 13.405,
      serviceAreaRadius: 50,
      isApproved: input.isApproved ?? true,
      documents: [],
      ...(input.topRated ? { ratingAvg: 5, totalReviews: 50 } : {}),
    },
  });

  for (const slug of input.categories ?? ["home-cleaning"]) {
    const category = await categoryBySlug(slug);
    await db().service.create({
      data: {
        providerId: provider.id,
        categoryId: category.id,
        title: category.nameEn,
        description: "Reliable local service provider.",
        priceType: "hourly",
        priceMin: 40,
        priceMax: 65,
        images: [],
      },
    });
  }

  const profile = await db().providerProfile.create({
    data: {
      providerId: provider.id,
      slug: `e2e-${provider.id.slice(0, 8)}`,
      headline: "Trusted local professional",
      bio: "Reliable local service provider.",
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

  return { user, provider, profile };
}

export async function createRequest(input: {
  customerId: string;
  title?: string;
  categorySlug?: string;
  status?: RequestStatus;
}) {
  const categorySlug = input.categorySlug ?? "home-cleaning";
  const category = await categoryBySlug(categorySlug);
  const parent = category.parentId
    ? await db().category.findUnique({ where: { id: category.parentId } })
    : null;

  return db().serviceRequest.create({
    data: {
      customerId: input.customerId,
      categoryId: category.id,
      requestSector: parent?.slug ?? null,
      requestBranch: categorySlug,
      title: input.title ?? `Apartment cleaning ${randomUUID().slice(0, 6)}`,
      description: "Please deep clean a 3-room apartment.",
      address: "Torstrasse 1",
      city: "Berlin",
      postalCode: "10115",
      lat: 52.52,
      lng: 13.405,
      budgetMin: 100,
      budgetMax: 200,
      status: input.status ?? "open",
      images: [],
    },
  });
}

export async function createQuote(input: {
  requestId: string;
  providerId: string;
  customerId: string;
  price?: number;
  status?: QuoteStatus;
}) {
  return db().quote.create({
    data: {
      requestId: input.requestId,
      providerId: input.providerId,
      customerId: input.customerId,
      price: input.price ?? 150,
      message: "I can do this on Saturday and bring all materials.",
      validUntil: daysFromNow(14),
      status: input.status ?? "pending",
    },
  });
}

export async function createBooking(input: {
  quoteId: string;
  customerId: string;
  providerId: string;
  status?: BookingStatus;
  totalPrice?: number;
}) {
  return db().booking.create({
    data: {
      quoteId: input.quoteId,
      customerId: input.customerId,
      providerId: input.providerId,
      scheduledDate: daysFromNow(5),
      status: input.status ?? "confirmed",
      totalPrice: input.totalPrice ?? 150,
      completedAt: input.status === "completed" ? new Date() : null,
    },
  });
}

/** Customer + approved provider + request + quote, optionally booked. */
export async function createDeal(input: {
  label: string;
  quoteStatus?: QuoteStatus;
  bookingStatus?: BookingStatus;
  requestStatus?: RequestStatus;
  title?: string;
}) {
  const customer = await createUser({ label: `${input.label}-customer` });
  const { user: providerUser, provider } = await createProvider({
    label: `${input.label}-provider`,
  });
  const serviceRequest = await createRequest({
    customerId: customer.id,
    title: input.title,
    status:
      input.requestStatus ?? (input.bookingStatus ? "in_progress" : "open"),
  });
  const quote = await createQuote({
    requestId: serviceRequest.id,
    providerId: provider.id,
    customerId: customer.id,
    status: input.quoteStatus ?? (input.bookingStatus ? "accepted" : "pending"),
  });
  const booking = input.bookingStatus
    ? await createBooking({
        quoteId: quote.id,
        customerId: customer.id,
        providerId: provider.id,
        status: input.bookingStatus,
      })
    : null;

  return { customer, providerUser, provider, serviceRequest, quote, booking };
}

export async function createConversation(input: {
  participantIds: string[];
  requestId?: string;
  messages?: { senderId: string; content: string }[];
}) {
  const conversation = await db().conversation.create({
    data: {
      requestId: input.requestId,
      participants: {
        create: input.participantIds.map((userId) => ({ userId })),
      },
    },
  });
  for (const message of input.messages ?? []) {
    await db().message.create({
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

export async function createNotification(input: {
  userId: string;
  title: string;
  message?: string;
  type?: string;
}) {
  return db().notification.create({
    data: {
      userId: input.userId,
      type: input.type ?? "quote_received",
      title: input.title,
      message: input.message ?? "Something happened.",
    },
  });
}
