import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as bcrypt from "bcrypt";
import { REQUEST_BRANCHES, REQUEST_SECTORS } from "../src/common/request-taxonomy";

// Load environment variables from .env file
dotenv.config();

const prisma = new PrismaClient();

const sectorIcons: Record<string, string> = {
  "home-repair": "🧰",
  "cleaning-care": "🪄",
  "education-hobby": "🎓",
  "art-events": "🎭",
  "health-beauty": "🪞",
  "digital-tech": "🧠",
  logistics: "🚚",
  "pet-care": "🐾",
};

const categories = REQUEST_BRANCHES.map((branch) => ({
  slug: branch.categorySlug,
  nameDe: branch.labelDe,
  nameEn: branch.labelEn,
  icon: branch.icon,
  parentSlug: branch.sectorId,
}));

const sectorCategories = REQUEST_SECTORS.map((sector) => ({
  slug: sector.id,
  nameDe: sector.labelDe,
  nameEn: sector.labelEn,
  icon: sectorIcons[sector.id] || "📁",
  isActive: false,
}));

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function upsertProviderProfile(
  providerId: string,
  companyName: string | null,
  fallbackName: string,
) {
  const baseSlug =
    toSlug(companyName || fallbackName) || `provider-${providerId.slice(0, 8)}`;
  const defaultHours = [
    { day: "monday", closed: false, open: "08:00", close: "18:00" },
    { day: "tuesday", closed: false, open: "08:00", close: "18:00" },
    { day: "wednesday", closed: false, open: "08:00", close: "18:00" },
    { day: "thursday", closed: false, open: "08:00", close: "18:00" },
    { day: "friday", closed: false, open: "08:00", close: "18:00" },
    { day: "saturday", closed: true },
    { day: "sunday", closed: true },
  ];

  await prisma.providerProfile.upsert({
    where: { providerId },
    update: {
      slug: `${baseSlug}-${providerId.slice(0, 6)}`,
      headline: "Trusted local professional",
      bio: "Reliable service provider with verified customer reviews on Armut.",
      city: "Berlin",
      postalCode: "10115",
      phoneVisible: true,
      highlights: ["Verified Provider", "Fast Response", "Transparent Pricing"],
      languages: ["German", "English"],
      openingHours: defaultHours,
    },
    create: {
      providerId,
      slug: `${baseSlug}-${providerId.slice(0, 6)}`,
      headline: "Trusted local professional",
      bio: "Reliable service provider with verified customer reviews on Armut.",
      city: "Berlin",
      postalCode: "10115",
      phoneVisible: true,
      highlights: ["Verified Provider", "Fast Response", "Transparent Pricing"],
      languages: ["German", "English"],
      openingHours: defaultHours,
    },
  });
}

async function main() {
  console.log("🌱 Seeding database...");

  const sectorCategoryMap = new Map();
  for (const sector of sectorCategories) {
    const sectorCategory = await prisma.category.upsert({
      where: { slug: sector.slug },
      update: {
        nameDe: sector.nameDe,
        nameEn: sector.nameEn,
        icon: sector.icon,
        isActive: false,
        parentId: null,
      },
      create: {
        slug: sector.slug,
        nameDe: sector.nameDe,
        nameEn: sector.nameEn,
        icon: sector.icon,
        isActive: false,
      },
    });
    sectorCategoryMap.set(sector.slug, sectorCategory);
  }

  const categoryMap = new Map();
  for (const category of categories) {
    const parent = sectorCategoryMap.get(category.parentSlug);
    const cat = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        slug: category.slug,
        nameDe: category.nameDe,
        nameEn: category.nameEn,
        icon: category.icon,
        isActive: true,
        parentId: parent?.id || null,
      },
      create: {
        slug: category.slug,
        nameDe: category.nameDe,
        nameEn: category.nameEn,
        icon: category.icon,
        isActive: true,
        parentId: parent?.id || null,
      },
    });
    categoryMap.set(category.slug, cat);
  }

  // Create Provider User
  const hashedPassword = await bcrypt.hash("12345678", 10);
  const providerEmail = "provider@test.com";

  const providerUser = await prisma.user.upsert({
    where: { email: providerEmail },
    update: {},
    create: {
      email: providerEmail,
      password: hashedPassword,
      firstName: "John",
      lastName: "Doe",
      userType: "provider",
      isVerified: true,
      gdprConsent: true,
      profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=John",
    },
  });

  // Create Provider Profile
  const provider = await prisma.provider.upsert({
    where: { userId: providerUser.id },
    update: {
      companyName: "John's Services",
      description: "Professional services for your home.",
      ratingAvg: 4.9,
      totalReviews: 47,
      isApproved: true,
    },
    create: {
      userId: providerUser.id,
      companyName: "John's Services",
      description: "Professional services for your home.",
      experienceYears: 5,
      ratingAvg: 4.9,
      totalReviews: 47,
      isApproved: true,
      serviceAreaLat: 52.52, // Berlin
      serviceAreaLng: 13.405,
      serviceAreaRadius: 50,
    },
  });

  await upsertProviderProfile(
    provider.id,
    provider.companyName,
    `${providerUser.firstName} ${providerUser.lastName}`,
  );

  console.log(`✅ Upserted provider: ${providerEmail}`);

  // Additional providers based on previous mock data
  const additionalProviders = [
    {
      email: "mark@test.com",
      firstName: "Mark",
      lastName: "Palmer",
      companyName: "Palmer Services",
      description: "Reliable home services with an eye for detail.",
      experienceYears: 10,
      ratingAvg: 4.9,
      totalReviews: 127,
      service: {
        categorySlug: "home-cleaning",
        title: "Home Cleaning",
        description: "Professional cleaning for apartments and houses.",
        priceMin: 25,
        priceMax: 35,
        priceType: "hourly" as const,
      },
    },
    {
      email: "olivia@test.com",
      firstName: "Olivia",
      lastName: "Smith",
      companyName: "Smith & Co",
      description: "Friendly, punctual, and thorough service every time.",
      experienceYears: 7,
      ratingAvg: 4.8,
      totalReviews: 89,
      service: {
        categorySlug: "deep-cleaning",
        title: "Deep Home Cleaning",
        description: "Detailed cleaning with flexible scheduling.",
        priceMin: 30,
        priceMax: 40,
        priceType: "hourly" as const,
      },
    },
    {
      email: "daniel@test.com",
      firstName: "Daniel",
      lastName: "Weaver",
      companyName: "Weaver Home Care",
      description: "Fast, tidy, and flexible scheduling.",
      experienceYears: 8,
      ratingAvg: 4.7,
      totalReviews: 156,
      service: {
        categorySlug: "home-cleaning",
        title: "Apartment Cleaning",
        description: "Efficient and reliable cleaning services.",
        priceMin: 28,
        priceMax: 38,
        priceType: "hourly" as const,
      },
    },
  ];

  for (const providerSeed of additionalProviders) {
    const user = await prisma.user.upsert({
      where: { email: providerSeed.email },
      update: {},
      create: {
        email: providerSeed.email,
        password: hashedPassword,
        firstName: providerSeed.firstName,
        lastName: providerSeed.lastName,
        userType: "provider",
        isVerified: true,
        gdprConsent: true,
        profileImage: `https://api.dicebear.com/7.x/avataaars/svg?seed=${providerSeed.firstName}`,
      },
    });

    const providerProfile = await prisma.provider.upsert({
      where: { userId: user.id },
      update: {
        companyName: providerSeed.companyName,
        description: providerSeed.description,
        ratingAvg: providerSeed.ratingAvg,
        totalReviews: providerSeed.totalReviews,
        isApproved: true,
      },
      create: {
        userId: user.id,
        companyName: providerSeed.companyName,
        description: providerSeed.description,
        experienceYears: providerSeed.experienceYears,
        ratingAvg: providerSeed.ratingAvg,
        totalReviews: providerSeed.totalReviews,
        isApproved: true,
        serviceAreaLat: 52.52,
        serviceAreaLng: 13.405,
        serviceAreaRadius: 50,
      },
    });

    await upsertProviderProfile(
      providerProfile.id,
      providerProfile.companyName,
      `${providerSeed.firstName} ${providerSeed.lastName}`,
    );

    const serviceCategory = categoryMap.get(providerSeed.service.categorySlug);
    if (serviceCategory) {
      const existingService = await prisma.service.findFirst({
        where: {
          providerId: providerProfile.id,
          categoryId: serviceCategory.id,
        },
      });

      if (!existingService) {
        await prisma.service.create({
          data: {
            providerId: providerProfile.id,
            categoryId: serviceCategory.id,
            title: providerSeed.service.title,
            description: providerSeed.service.description,
            priceMin: providerSeed.service.priceMin,
            priceMax: providerSeed.service.priceMax,
            priceType: providerSeed.service.priceType,
          },
        });
      }
    }
  }

  // Create Customer User
  const customerEmail = "customer@test.com";
  const customerUser = await prisma.user.upsert({
    where: { email: customerEmail },
    update: {},
    create: {
      email: customerEmail,
      password: hashedPassword,
      firstName: "Anna",
      lastName: "Miller",
      userType: "customer",
      isVerified: true,
      gdprConsent: true,
      profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=Anna",
    },
  });

  console.log(`✅ Upserted customer: ${customerEmail}`);

  // Add Services to Provider
  const homeCleaningCat = categoryMap.get("home-cleaning");
  const officeCleaningCat = categoryMap.get("office-cleaning");
  const deepCleaningCat = categoryMap.get("deep-cleaning");
  if (homeCleaningCat) {
    // Check if service exists
    const existingService = await prisma.service.findFirst({
      where: { providerId: provider.id, categoryId: homeCleaningCat.id },
    });

    if (!existingService) {
      await prisma.service.create({
        data: {
          providerId: provider.id,
          categoryId: homeCleaningCat.id,
          title: "Professional Home Cleaning",
          description: "Deep cleaning for your apartment or house.",
          priceMin: 20,
          priceMax: 30,
          priceType: "hourly",
        },
      });
      console.log("✅ Created cleaning service for provider");
    }
  }

  // Create "Recent Requests" (Open requests matching provider service)
  if (homeCleaningCat && deepCleaningCat) {
    // Cleanup existing test data if needed? No, just create new ones unique enough or rely on cleanup elsewhere.
    // But seeding is often additive or idempotent.
    // Let's check if requests exist to avoid dupes on re-seed
    const count = await prisma.serviceRequest.count({
      where: { title: "Have apartment cleaned (80sqm)" },
    });
    if (count === 0) {
      await prisma.serviceRequest.create({
        data: {
          customerId: customerUser.id,
          categoryId: homeCleaningCat!.id,
          requestSector: "cleaning-care",
          requestBranch: "home-cleaning",
          title: "Have apartment cleaned (80sqm)",
          description: "Need cleaning for 3 room apartment, standard cleaning.",
          postalCode: "10115",
          city: "Berlin",
          address: "Torstrasse 1",
          lat: 52.53,
          lng: 13.4,
          budgetMin: 100,
          budgetMax: 150,
          status: "open",
        },
      });
      console.log(`✅ Created open request 1`);
    }

    const count2 = await prisma.serviceRequest.count({
      where: { title: "Move out cleaning" },
    });
    if (count2 === 0) {
      await prisma.serviceRequest.create({
        data: {
          customerId: customerUser.id,
          categoryId: deepCleaningCat!.id,
          requestSector: "cleaning-care",
          requestBranch: "deep-cleaning",
          title: "Move out cleaning",
          description: "Deep cleaning for handover.",
          postalCode: "10119",
          city: "Berlin",
          address: "Brunnenstrasse 10",
          lat: 52.53,
          lng: 13.4,
          budgetMin: 200,
          budgetMax: 300,
          status: "open",
        },
      });
      console.log(`✅ Created open request 2`);
    }
  }

  // Create "Active Bookings" / Calendar Events
  if (homeCleaningCat && officeCleaningCat && deepCleaningCat) {
    const activeBookingExists = await prisma.booking.findFirst({
      where: { providerId: provider.id, status: "confirmed" },
    });

    if (!activeBookingExists) {
      // Booking 1: Window Cleaning
      const bookingReq1 = await prisma.serviceRequest.create({
        data: {
          customerId: customerUser.id,
          categoryId: homeCleaningCat.id,
          requestSector: "cleaning-care",
          requestBranch: "home-cleaning",
          title: "Window Cleaning",
          description: "Window cleaning for apartment.",
          postalCode: "10115",
          city: "Berlin",
          address: "Hauptstrasse 12, 10115 Berlin",
          lat: 52.53,
          lng: 13.4,
          status: "in_progress",
        },
      });
      const quote1 = await prisma.quote.create({
        data: {
          requestId: bookingReq1.id,
          providerId: provider.id,
          customerId: customerUser.id,
          price: 80,
          message: "I can do this.",
          validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: "accepted",
        },
      });
      await prisma.booking.create({
        data: {
          quoteId: quote1.id,
          customerId: customerUser.id,
          providerId: provider.id,
          scheduledDate: new Date("2026-02-15T10:00:00"),
          status: "confirmed",
          totalPrice: 80,
          paymentStatus: "paid",
        },
      });

      // Booking 2: Office Cleaning - Pending
      const bookingReq2 = await prisma.serviceRequest.create({
        data: {
          customerId: customerUser.id,
          categoryId: officeCleaningCat.id,
          requestSector: "cleaning-care",
          requestBranch: "office-cleaning",
          title: "Office Cleaning",
          description: "Office cleaning for small office.",
          postalCode: "10117",
          city: "Berlin",
          address: "Friedrichstrasse 45, 10117 Berlin",
          lat: 52.51,
          lng: 13.39,
          status: "in_progress",
        },
      });
      const quote2 = await prisma.quote.create({
        data: {
          requestId: bookingReq2.id,
          providerId: provider.id,
          customerId: customerUser.id,
          price: 150,
          message: "I can do this regularly.",
          validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: "accepted",
        },
      });
      await prisma.booking.create({
        data: {
          quoteId: quote2.id,
          customerId: customerUser.id,
          providerId: provider.id,
          scheduledDate: new Date("2026-02-17T09:00:00"),
          status: "pending",
          totalPrice: 150,
          paymentStatus: "pending",
        },
      });

      // Booking 3: Deep Cleaning
      const bookingReq3 = await prisma.serviceRequest.create({
        data: {
          customerId: customerUser.id,
          categoryId: deepCleaningCat.id,
          requestSector: "cleaning-care",
          requestBranch: "deep-cleaning",
          title: "Deep Cleaning",
          description: "Deep cleaning for apartment.",
          postalCode: "10439",
          city: "Berlin",
          address: "Schoenhauser Allee 78, 10439 Berlin",
          lat: 52.55,
          lng: 13.42,
          status: "in_progress",
        },
      });
      const quote3 = await prisma.quote.create({
        data: {
          requestId: bookingReq3.id,
          providerId: provider.id,
          customerId: customerUser.id,
          price: 200,
          message: "Deep cleaning service.",
          validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: "accepted",
        },
      });
      await prisma.booking.create({
        data: {
          quoteId: quote3.id,
          customerId: customerUser.id,
          providerId: provider.id,
          scheduledDate: new Date("2026-02-20T14:00:00"),
          status: "confirmed",
          totalPrice: 200,
          paymentStatus: "paid",
        },
      });

      console.log("✅ Created calendar bookings (3 events)");
    }
  }

  // Create Additional Customers for Mock Data
  const additionalCustomers = [
    { email: "thomas@test.com", firstName: "Thomas", lastName: "Webb" },
    { email: "sarah@test.com", firstName: "Sarah", lastName: "Lewis" },
    { email: "michael@test.com", firstName: "Michael", lastName: "Brown" },
  ];

  const customerMap = new Map();
  customerMap.set(customerUser.email, customerUser);

  for (const cust of additionalCustomers) {
    const user = await prisma.user.upsert({
      where: { email: cust.email },
      update: {},
      create: {
        email: cust.email,
        password: hashedPassword,
        firstName: cust.firstName,
        lastName: cust.lastName,
        userType: "customer",
        isVerified: true,
        gdprConsent: true,
        profileImage: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cust.firstName}`,
      },
    });
    customerMap.set(cust.email, user);
  }
  console.log("✅ Created additional customers");

  // Create additional open requests from mock data
  const renovierungCat = categoryMap.get("renovation");
  const gardenCat = categoryMap.get("garden-maintenance");
  const elektrikerCat = categoryMap.get("electrician");

  // Add services to provider for these categories so requests appear
  if (renovierungCat) {
    const existingService = await prisma.service.findFirst({
      where: { providerId: provider.id, categoryId: renovierungCat.id },
    });
    if (!existingService) {
      await prisma.service.create({
        data: {
          providerId: provider.id,
          categoryId: renovierungCat.id,
          title: "Bathroom Renovation",
          description: "Complete bathroom renovation service.",
          priceMin: 2000,
          priceMax: 5000,
          priceType: "fixed",
        },
      });
    }
  }
  if (gardenCat) {
    const existingService = await prisma.service.findFirst({
      where: { providerId: provider.id, categoryId: gardenCat.id },
    });
    if (!existingService) {
      await prisma.service.create({
        data: {
          providerId: provider.id,
          categoryId: gardenCat.id,
          title: "Garden Maintenance",
          description: "Full garden maintenance service.",
          priceMin: 100,
          priceMax: 300,
          priceType: "fixed",
        },
      });
    }
  }
  if (elektrikerCat) {
    const existingService = await prisma.service.findFirst({
      where: { providerId: provider.id, categoryId: elektrikerCat.id },
    });
    if (!existingService) {
      await prisma.service.create({
        data: {
          providerId: provider.id,
          categoryId: elektrikerCat.id,
          title: "Electrical Work",
          description: "Professional electrical services.",
          priceMin: 50,
          priceMax: 500,
          priceType: "hourly",
        },
      });
    }
  }
  console.log("✅ Created additional provider services");

  // Create open requests matching mock data in requests page
  if (renovierungCat) {
    const count = await prisma.serviceRequest.count({
      where: { title: "Renovate a bathroom" },
    });
    if (count === 0) {
      await prisma.serviceRequest.create({
        data: {
          customerId: customerMap.get("thomas@test.com").id,
          categoryId: renovierungCat.id,
          requestSector: "home-repair",
          requestBranch: "renovation",
          title: "Renovate a bathroom",
          description:
            "Full renovation of a small bathroom (6 sqm). New tiles and fixtures.",
          postalCode: "10117",
          city: "Berlin",
          address: "Friedrichstrasse 10",
          lat: 52.52,
          lng: 13.39,
          budgetMin: 2000,
          budgetMax: 3500,
          status: "open",
        },
      });
      console.log("✅ Created open request: Renovate a bathroom");
    }
  }
  if (gardenCat) {
    const count = await prisma.serviceRequest.count({
      where: { title: "Prepare garden for winter" },
    });
    if (count === 0) {
      await prisma.serviceRequest.create({
        data: {
          customerId: customerMap.get("sarah@test.com").id,
          categoryId: gardenCat.id,
          requestSector: "cleaning-care",
          requestBranch: "garden-maintenance",
          title: "Prepare garden for winter",
          description:
            "Garden (200 sqm) needs winter prep. Trim hedges and remove leaves.",
          postalCode: "10119",
          city: "Berlin",
          address: "Gartenstrasse 15",
          lat: 52.53,
          lng: 13.41,
          budgetMin: 150,
          budgetMax: 250,
          status: "open",
        },
      });
      console.log("✅ Created open request: Prepare garden for winter");
    }
  }
  if (elektrikerCat) {
    const count = await prisma.serviceRequest.count({
      where: { title: "Inspect electrical installation" },
    });
    if (count === 0) {
      await prisma.serviceRequest.create({
        data: {
          customerId: customerMap.get("michael@test.com").id,
          categoryId: elektrikerCat.id,
          requestSector: "home-repair",
          requestBranch: "electrician",
          title: "Inspect electrical installation",
          description:
            "Check old wiring in an older apartment and upgrade the fuse box if needed.",
          postalCode: "10405",
          city: "Berlin",
          address: "Prenzlauer Allee 50",
          lat: 52.54,
          lng: 13.42,
          budgetMin: 500,
          budgetMax: 1000,
          status: "open",
        },
      });
      console.log("✅ Created open request: Inspect electrical installation");
    }
  }

  // Create Completed Bookings with Reviews (from reviews page mock data)
  if (homeCleaningCat && officeCleaningCat && deepCleaningCat) {
    const existingReview = await prisma.review.findFirst({
      where: { revieweeId: providerUser.id },
    });

    if (!existingReview) {
      // Review 1: Window cleaning - 5 stars
      const reviewReq1 = await prisma.serviceRequest.create({
        data: {
          customerId: customerUser.id,
          categoryId: homeCleaningCat.id,
          requestSector: "cleaning-care",
          requestBranch: "home-cleaning",
          title: "Window Cleaning",
          description: "Window cleaning completed",
          postalCode: "10115",
          city: "Berlin",
          address: "Hauptstrasse 12",
          lat: 52.53,
          lng: 13.4,
          status: "completed",
        },
      });
      const reviewQuote1 = await prisma.quote.create({
        data: {
          requestId: reviewReq1.id,
          providerId: provider.id,
          customerId: customerUser.id,
          price: 80,
          message: "Window cleaning",
          validUntil: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          status: "accepted",
        },
      });
      const reviewBooking1 = await prisma.booking.create({
        data: {
          quoteId: reviewQuote1.id,
          customerId: customerUser.id,
          providerId: provider.id,
          scheduledDate: new Date("2026-01-10T10:00:00"),
          status: "completed",
          completedAt: new Date("2026-01-10T12:00:00"),
          totalPrice: 80,
          paymentStatus: "paid",
        },
      });
      await prisma.review.create({
        data: {
          bookingId: reviewBooking1.id,
          reviewerId: customerUser.id,
          revieweeId: providerUser.id,
          rating: 5,
          comment:
            "Excellent work! The windows shine like new. Very punctual and professional. Highly recommended!",
          providerReply: null,
        },
      });

      // Review 2: Office cleaning - 5 stars with reply
      const thomasUser = customerMap.get("thomas@test.com");
      const reviewReq2 = await prisma.serviceRequest.create({
        data: {
          customerId: thomasUser.id,
          categoryId: officeCleaningCat.id,
          requestSector: "cleaning-care",
          requestBranch: "office-cleaning",
          title: "Office Cleaning",
          description: "Office cleaning completed",
          postalCode: "10117",
          city: "Berlin",
          address: "Friedrichstrasse 45",
          lat: 52.51,
          lng: 13.39,
          status: "completed",
        },
      });
      const reviewQuote2 = await prisma.quote.create({
        data: {
          requestId: reviewReq2.id,
          providerId: provider.id,
          customerId: thomasUser.id,
          price: 150,
          message: "Office cleaning",
          validUntil: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
          status: "accepted",
        },
      });
      const reviewBooking2 = await prisma.booking.create({
        data: {
          quoteId: reviewQuote2.id,
          customerId: thomasUser.id,
          providerId: provider.id,
          scheduledDate: new Date("2026-01-05T09:00:00"),
          status: "completed",
          completedAt: new Date("2026-01-05T13:00:00"),
          totalPrice: 150,
          paymentStatus: "paid",
        },
      });
      await prisma.review.create({
        data: {
          bookingId: reviewBooking2.id,
          reviewerId: thomasUser.id,
          revieweeId: providerUser.id,
          rating: 5,
          comment:
            "Very satisfied with the service. Clean, thorough, and reliable. We'll book again.",
          providerReply:
            "Thank you for the positive review! We look forward to working together again.",
        },
      });

      // Review 3: Deep cleaning - 4 stars with reply
      const sarahUser = customerMap.get("sarah@test.com");
      const reviewReq3 = await prisma.serviceRequest.create({
        data: {
          customerId: sarahUser.id,
          categoryId: deepCleaningCat.id,
          requestSector: "cleaning-care",
          requestBranch: "deep-cleaning",
          title: "Deep Cleaning",
          description: "Deep cleaning completed",
          postalCode: "10439",
          city: "Berlin",
          address: "Schoenhauser Allee 78",
          lat: 52.55,
          lng: 13.42,
          status: "completed",
        },
      });
      const reviewQuote3 = await prisma.quote.create({
        data: {
          requestId: reviewReq3.id,
          providerId: provider.id,
          customerId: sarahUser.id,
          price: 200,
          message: "Deep cleaning",
          validUntil: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000),
          status: "accepted",
        },
      });
      const reviewBooking3 = await prisma.booking.create({
        data: {
          quoteId: reviewQuote3.id,
          customerId: sarahUser.id,
          providerId: provider.id,
          scheduledDate: new Date("2025-12-28T14:00:00"),
          status: "completed",
          completedAt: new Date("2025-12-28T17:00:00"),
          totalPrice: 200,
          paymentStatus: "paid",
        },
      });
      await prisma.review.create({
        data: {
          bookingId: reviewBooking3.id,
          reviewerId: sarahUser.id,
          revieweeId: providerUser.id,
          rating: 4,
          comment:
            "Good cleaning overall. A small area was missed, but it was fixed right away.",
          providerReply:
            "Thanks for the feedback! We're always working to improve.",
        },
      });

      // Review 4: Move-out cleaning - 5 stars no reply
      const michaelUser = customerMap.get("michael@test.com");
      const reviewReq4 = await prisma.serviceRequest.create({
        data: {
          customerId: michaelUser.id,
          categoryId: deepCleaningCat.id,
          requestSector: "cleaning-care",
          requestBranch: "deep-cleaning",
          title: "Move-out Cleaning",
          description: "Move-out cleaning completed",
          postalCode: "10119",
          city: "Berlin",
          address: "Brunnenstrasse 20",
          lat: 52.53,
          lng: 13.4,
          status: "completed",
        },
      });
      const reviewQuote4 = await prisma.quote.create({
        data: {
          requestId: reviewReq4.id,
          providerId: provider.id,
          customerId: michaelUser.id,
          price: 250,
          message: "Move-out cleaning",
          validUntil: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          status: "accepted",
        },
      });
      const reviewBooking4 = await prisma.booking.create({
        data: {
          quoteId: reviewQuote4.id,
          customerId: michaelUser.id,
          providerId: provider.id,
          scheduledDate: new Date("2025-12-20T10:00:00"),
          status: "completed",
          completedAt: new Date("2025-12-20T14:00:00"),
          totalPrice: 250,
          paymentStatus: "paid",
        },
      });
      await prisma.review.create({
        data: {
          bookingId: reviewBooking4.id,
          reviewerId: michaelUser.id,
          revieweeId: providerUser.id,
          rating: 5,
          comment:
            "Perfect! The apartment looked brand new when they finished. I got my full deposit back.",
          providerReply: null,
        },
      });

      console.log("✅ Created completed bookings with reviews (4 reviews)");
    }
  }

  // Create seeded conversation and messages between the main provider and customer
  const seedRequest = await prisma.serviceRequest.findFirst({
    where: {
      customerId: customerUser.id,
      title: "Have apartment cleaned (80sqm)",
    },
    orderBy: { createdAt: "asc" },
  });

  let seededConversation = await prisma.conversation.findFirst({
    where: {
      participants: {
        some: { userId: providerUser.id },
      },
      AND: [
        {
          participants: {
            some: { userId: customerUser.id },
          },
        },
      ],
      requestId: seedRequest?.id ?? null,
    },
    orderBy: { createdAt: "asc" },
  });

  if (!seededConversation) {
    seededConversation = await prisma.conversation.create({
      data: {
        requestId: seedRequest?.id,
        participants: {
          create: [{ userId: providerUser.id }, { userId: customerUser.id }],
        },
      },
    });
    console.log("âœ… Created seeded conversation");
  }

  const seededMessagesCount = await prisma.message.count({
    where: { conversationId: seededConversation.id },
  });

  if (seededMessagesCount === 0) {
    const firstMessageAt = new Date("2026-02-21T09:10:00.000Z");
    const secondMessageAt = new Date("2026-02-21T09:22:00.000Z");
    const thirdMessageAt = new Date("2026-02-21T09:30:00.000Z");
    const fourthMessageAt = new Date("2026-02-21T09:36:00.000Z");
    const fifthMessageAt = new Date("2026-02-21T09:42:00.000Z");

    await prisma.message.createMany({
      data: [
        {
          conversationId: seededConversation.id,
          senderId: customerUser.id,
          content: "Hi John, is Monday morning possible for the cleaning?",
          attachments: [],
          createdAt: firstMessageAt,
          readAt: secondMessageAt,
        },
        {
          conversationId: seededConversation.id,
          senderId: providerUser.id,
          content: "Hi Anna, yes Monday works. I can be there at 09:00.",
          attachments: [],
          createdAt: secondMessageAt,
          readAt: thirdMessageAt,
        },
        {
          conversationId: seededConversation.id,
          senderId: customerUser.id,
          content: "Perfect. Should I provide any cleaning products?",
          attachments: [],
          createdAt: thirdMessageAt,
          readAt: fourthMessageAt,
        },
        {
          conversationId: seededConversation.id,
          senderId: providerUser.id,
          content: "No need, I will bring everything required.",
          attachments: [],
          createdAt: fourthMessageAt,
          readAt: fifthMessageAt,
        },
        {
          conversationId: seededConversation.id,
          senderId: customerUser.id,
          content: "Great, see you on Monday then.",
          attachments: [],
          createdAt: fifthMessageAt,
          readAt: null,
        },
      ],
    });

    await prisma.conversation.update({
      where: { id: seededConversation.id },
      data: { lastMessageAt: fifthMessageAt },
    });

    console.log("âœ… Created seeded messages");
  }

  // Update provider rating stats based on reviews
  const reviewStats = await prisma.review.aggregate({
    where: { revieweeId: providerUser.id },
    _avg: { rating: true },
    _count: { rating: true },
  });

  if (reviewStats._avg.rating) {
    await prisma.provider.update({
      where: { id: provider.id },
      data: {
        ratingAvg: reviewStats._avg.rating,
        totalReviews: reviewStats._count.rating,
      },
    });
    console.log(
      `✅ Updated provider rating: ${reviewStats._avg.rating.toFixed(1)} (${reviewStats._count.rating} reviews)`,
    );
  }

  console.log("✅ Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
