import { PrismaClient, RequestStatus, BookingStatus, QuoteStatus, PaymentStatus } from "@prisma/client";
import * as dotenv from "dotenv";
import * as bcrypt from "bcrypt";

// Load environment variables from .env file
dotenv.config();

const prisma = new PrismaClient();

const categories = [
  {
    slug: "reinigung",
    nameDe: "Reinigung",
    nameEn: "Cleaning",
    icon: "🧹",
  },
  {
    slug: "umzug",
    nameDe: "Umzug",
    nameEn: "Moving",
    icon: "📦",
  },
  {
    slug: "renovierung",
    nameDe: "Renovierung",
    nameEn: "Renovation",
    icon: "🔨",
  },
  {
    slug: "garten",
    nameDe: "Garten",
    nameEn: "Garden",
    icon: "🌳",
  },
  {
    slug: "elektriker",
    nameDe: "Elektriker",
    nameEn: "Electrician",
    icon: "⚡",
  },
  {
    slug: "klempner",
    nameDe: "Klempner",
    nameEn: "Plumber",
    icon: "🔧",
  },
  {
    slug: "maler",
    nameDe: "Maler",
    nameEn: "Painter",
    icon: "🎨",
  },
  {
    slug: "schlosser",
    nameDe: "Schlosser",
    nameEn: "Locksmith",
    icon: "🔐",
  },
  {
    slug: "nachhilfe",
    nameDe: "Nachhilfe",
    nameEn: "Tutoring",
    icon: "📚",
  },
  {
    slug: "fotografie",
    nameDe: "Fotografie",
    nameEn: "Photography",
    icon: "📷",
  },
  {
    slug: "computerhilfe",
    nameDe: "Computerhilfe",
    nameEn: "Computer Help",
    icon: "💻",
  },
  {
    slug: "tierpflege",
    nameDe: "Tierpflege",
    nameEn: "Pet Care",
    icon: "🐕",
  },
];

async function main() {
  console.log("🌱 Seeding database...");

  // Create categories
  const categoryMap = new Map();
  for (const category of categories) {
    const cat = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        ...category,
        isActive: true,
      },
      create: {
        ...category,
        isActive: true,
      },
    });
    categoryMap.set(category.slug, cat);
    // console.log(`✅ Upserted category: ${category.nameEn}`);
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
        serviceAreaLat: 52.5200, // Berlin
        serviceAreaLng: 13.4050,
        serviceAreaRadius: 50,
    }
  });

  console.log(`✅ Upserted provider: ${providerEmail}`);

  // Create Customer User
  const customerEmail = "customer@test.com";
  const customerUser = await prisma.user.upsert({
    where: { email: customerEmail },
    update: {},
    create: {
      email: customerEmail,
      password: hashedPassword,
      firstName: "Anna",
      lastName: "Müller",
      userType: "customer",
      isVerified: true,
      gdprConsent: true,
      profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=Anna",
    },
  });
  
  console.log(`✅ Upserted customer: ${customerEmail}`);

  // Add Services to Provider
  const cleaningCat = categoryMap.get("reinigung");
  if (cleaningCat) {
      // Check if service exists
      const existingService = await prisma.service.findFirst({
          where: { providerId: provider.id, categoryId: cleaningCat.id }
      });

      if (!existingService) {
        await prisma.service.create({
            data: {
                providerId: provider.id,
                categoryId: cleaningCat.id,
                title: "Professional Home Cleaning",
                description: "Deep cleaning for your apartment or house.",
                priceMin: 20,
                priceMax: 30,
                priceType: "hourly",
            }
        });
        console.log("✅ Created cleaning service for provider");
      }
  }

  // Create "Recent Requests" (Open requests matching provider service)
  if (cleaningCat) {
      // Cleanup existing test data if needed? No, just create new ones unique enough or rely on cleanup elsewhere.
      // But seeding is often additive or idempotent.
      // Let's check if requests exist to avoid dupes on re-seed
      const count = await prisma.serviceRequest.count({ where: { title: "Have apartment cleaned (80sqm)" } });
      if (count === 0) {
        await prisma.serviceRequest.create({
            data: {
              customerId: customerUser.id,
              categoryId: cleaningCat.id,
              title: "Have apartment cleaned (80sqm)",
              description: "Need cleaning for 3 room apartment, standard cleaning.",
              postalCode: "10115",
              city: "Berlin",
              address: "Torstraße 1",
              lat: 52.53,
              lng: 13.4,
              budgetMin: 100,
              budgetMax: 150,
              status: "open",
            }
        });
        console.log(`✅ Created open request 1`);
      }

      const count2 = await prisma.serviceRequest.count({ where: { title: "Move out cleaning" } });
      if (count2 === 0) {
        await prisma.serviceRequest.create({
          data: {
            customerId: customerUser.id,
            categoryId: cleaningCat.id,
            title: "Move out cleaning",
            description: "Deep cleaning for handover.",
            postalCode: "10119",
            city: "Berlin",
            address: "Brunnenstraße 10",
            lat: 52.53,
            lng: 13.4,
            budgetMin: 200,
            budgetMax: 300,
            status: "open",
          }
      });
      console.log(`✅ Created open request 2`);
      }
  }

  // Create "Active Bookings"
  if (cleaningCat) {
      const activeBookingExists = await prisma.booking.findFirst({
          where: { providerId: provider.id, status: "confirmed" }
      });
      
      if (!activeBookingExists) {
        // 1. Create Request
        const bookingReq = await prisma.serviceRequest.create({
          data: {
              customerId: customerUser.id,
              categoryId: cleaningCat.id,
              title: "Weekly Office Cleaning",
              description: "Small office cleaning",
              postalCode: "10117",
              city: "Berlin",
              address: "Unter den Linden 5",
              lat: 52.51,
              lng: 13.39,
              status: "in_progress",
          }
        });

        // 2. Create Accepted Quote
        const quote = await prisma.quote.create({
            data: {
                requestId: bookingReq.id,
                providerId: provider.id,
                customerId: customerUser.id,
                price: 120,
                message: "I can do this regularly.",
                validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                status: "accepted",
            }
        });

        // 3. Create Booking
        await prisma.booking.create({
            data: {
                quoteId: quote.id,
                customerId: customerUser.id,
                providerId: provider.id,
                scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
                status: "confirmed",
                totalPrice: 120,
                paymentStatus: "paid",
            }
        });
        console.log("✅ Created active booking");
      }
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
