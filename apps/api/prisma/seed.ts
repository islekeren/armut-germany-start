import { PrismaClient, RequestStatus, BookingStatus, QuoteStatus, PaymentStatus } from "@prisma/client";
import * as dotenv from "dotenv";
import * as bcrypt from "bcrypt";

// Load environment variables from .env file
dotenv.config();

const prisma = new PrismaClient();

const categories = [
  {
    slug: "cleaning",
    nameDe: "Reinigung",
    nameEn: "Cleaning",
    icon: "🧹",
  },
  {
    slug: "moving",
    nameDe: "Umzug",
    nameEn: "Moving",
    icon: "📦",
  },
  {
    slug: "renovation",
    nameDe: "Renovierung",
    nameEn: "Renovation",
    icon: "🔨",
  },
  {
    slug: "garden",
    nameDe: "Garten",
    nameEn: "Garden",
    icon: "🌳",
  },
  {
    slug: "electrician",
    nameDe: "Elektriker",
    nameEn: "Electrician",
    icon: "⚡",
  },
  {
    slug: "plumber",
    nameDe: "Klempner",
    nameEn: "Plumber",
    icon: "🔧",
  },
  {
    slug: "painter",
    nameDe: "Maler",
    nameEn: "Painter",
    icon: "🎨",
  },
  {
    slug: "locksmith",
    nameDe: "Schlosser",
    nameEn: "Locksmith",
    icon: "🔐",
  },
  {
    slug: "tutoring",
    nameDe: "Nachhilfe",
    nameEn: "Tutoring",
    icon: "📚",
  },
  {
    slug: "photography",
    nameDe: "Fotografie",
    nameEn: "Photography",
    icon: "📷",
  },
  {
    slug: "computerHelp",
    nameDe: "Computerhilfe",
    nameEn: "Computer Help",
    icon: "💻",
  },
  {
    slug: "petCare",
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
  const cleaningCat = categoryMap.get("cleaning");
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

  // Create "Active Bookings" / Calendar Events
  if (cleaningCat) {
      const activeBookingExists = await prisma.booking.findFirst({
          where: { providerId: provider.id, status: "confirmed" }
      });
      
      if (!activeBookingExists) {
        // Booking 1: Fensterreinigung (Window Cleaning)
        const bookingReq1 = await prisma.serviceRequest.create({
          data: {
              customerId: customerUser.id,
              categoryId: cleaningCat.id,
              title: "Fensterreinigung",
              description: "Window cleaning for apartment.",
              postalCode: "10115",
              city: "Berlin",
              address: "Hauptstraße 12, 10115 Berlin",
              lat: 52.53,
              lng: 13.4,
              status: "in_progress",
          }
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
            }
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
            }
        });

        // Booking 2: Büroreinigung (Office Cleaning) - Pending
        const bookingReq2 = await prisma.serviceRequest.create({
          data: {
              customerId: customerUser.id,
              categoryId: cleaningCat.id,
              title: "Büroreinigung",
              description: "Office cleaning for small office.",
              postalCode: "10117",
              city: "Berlin",
              address: "Friedrichstraße 45, 10117 Berlin",
              lat: 52.51,
              lng: 13.39,
              status: "in_progress",
          }
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
            }
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
            }
        });

        // Booking 3: Grundreinigung (Deep Cleaning)
        const bookingReq3 = await prisma.serviceRequest.create({
          data: {
              customerId: customerUser.id,
              categoryId: cleaningCat.id,
              title: "Grundreinigung",
              description: "Deep cleaning for apartment.",
              postalCode: "10439",
              city: "Berlin",
              address: "Schönhauser Allee 78, 10439 Berlin",
              lat: 52.55,
              lng: 13.42,
              status: "in_progress",
          }
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
            }
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
            }
        });

        console.log("✅ Created calendar bookings (3 events)");
      }
  }

  // Create Additional Customers for Mock Data
  const additionalCustomers = [
    { email: "thomas@test.com", firstName: "Thomas", lastName: "Weber" },
    { email: "sarah@test.com", firstName: "Sarah", lastName: "Klein" },
    { email: "michael@test.com", firstName: "Michael", lastName: "Braun" },
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
  const gardenCat = categoryMap.get("garden");
  const elektrikerCat = categoryMap.get("electrician");

  // Add services to provider for these categories so requests appear
  if (renovierungCat) {
    const existingService = await prisma.service.findFirst({
      where: { providerId: provider.id, categoryId: renovierungCat.id }
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
        }
      });
    }
  }
  if (gardenCat) {
    const existingService = await prisma.service.findFirst({
      where: { providerId: provider.id, categoryId: gardenCat.id }
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
        }
      });
    }
  }
  if (elektrikerCat) {
    const existingService = await prisma.service.findFirst({
      where: { providerId: provider.id, categoryId: elektrikerCat.id }
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
        }
      });
    }
  }
  console.log("✅ Created additional provider services");

  // Create open requests matching mock data in requests page
  if (renovierungCat) {
    const count = await prisma.serviceRequest.count({ where: { title: "Badezimmer renovieren" } });
    if (count === 0) {
      await prisma.serviceRequest.create({
        data: {
          customerId: customerMap.get("thomas@test.com").id,
          categoryId: renovierungCat.id,
          title: "Badezimmer renovieren",
          description: "Komplette Renovierung eines kleinen Badezimmers (6qm). Neue Fliesen, Sanitäranlagen.",
          postalCode: "10117",
          city: "Berlin",
          address: "Friedrichstraße 10",
          lat: 52.52,
          lng: 13.39,
          budgetMin: 2000,
          budgetMax: 3500,
          status: "open",
        }
      });
      console.log("✅ Created open request: Badezimmer renovieren");
    }
  }
  if (gardenCat) {
    const count = await prisma.serviceRequest.count({ where: { title: "Garten winterfest machen" } });
    if (count === 0) {
      await prisma.serviceRequest.create({
        data: {
          customerId: customerMap.get("sarah@test.com").id,
          categoryId: gardenCat.id,
          title: "Garten winterfest machen",
          description: "Garten (200qm) muss winterfest gemacht werden. Hecken schneiden, Laub entfernen.",
          postalCode: "10119",
          city: "Berlin",
          address: "Gartenstraße 15",
          lat: 52.53,
          lng: 13.41,
          budgetMin: 150,
          budgetMax: 250,
          status: "open",
        }
      });
      console.log("✅ Created open request: Garten winterfest machen");
    }
  }
  if (elektrikerCat) {
    const count = await prisma.serviceRequest.count({ where: { title: "Elektrische Installation prüfen" } });
    if (count === 0) {
      await prisma.serviceRequest.create({
        data: {
          customerId: customerMap.get("michael@test.com").id,
          categoryId: elektrikerCat.id,
          title: "Elektrische Installation prüfen",
          description: "Alte Elektrik in Altbauwohnung überprüfen und ggf. erneuern. Sicherungskasten modernisieren.",
          postalCode: "10405",
          city: "Berlin",
          address: "Prenzlauer Allee 50",
          lat: 52.54,
          lng: 13.42,
          budgetMin: 500,
          budgetMax: 1000,
          status: "open",
        }
      });
      console.log("✅ Created open request: Elektrische Installation prüfen");
    }
  }

  // Create Completed Bookings with Reviews (from reviews page mock data)
  if (cleaningCat) {
    const existingReview = await prisma.review.findFirst({
      where: { revieweeId: providerUser.id }
    });
    
    if (!existingReview) {
      // Review 1: Fensterreinigung - 5 stars
      const reviewReq1 = await prisma.serviceRequest.create({
        data: {
          customerId: customerUser.id,
          categoryId: cleaningCat.id,
          title: "Fensterreinigung",
          description: "Window cleaning completed",
          postalCode: "10115",
          city: "Berlin",
          address: "Hauptstraße 12",
          lat: 52.53,
          lng: 13.4,
          status: "completed",
        }
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
        }
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
        }
      });
      await prisma.review.create({
        data: {
          bookingId: reviewBooking1.id,
          reviewerId: customerUser.id,
          revieweeId: providerUser.id,
          rating: 5,
          comment: "Hervorragende Arbeit! Die Fenster glänzen wie neu. Sehr pünktlich und professionell. Kann ich nur weiterempfehlen!",
          providerReply: null,
        }
      });

      // Review 2: Büroreinigung - 5 stars with reply
      const thomasUser = customerMap.get("thomas@test.com");
      const reviewReq2 = await prisma.serviceRequest.create({
        data: {
          customerId: thomasUser.id,
          categoryId: cleaningCat.id,
          title: "Büroreinigung",
          description: "Office cleaning completed",
          postalCode: "10117",
          city: "Berlin",
          address: "Friedrichstraße 45",
          lat: 52.51,
          lng: 13.39,
          status: "completed",
        }
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
        }
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
        }
      });
      await prisma.review.create({
        data: {
          bookingId: reviewBooking2.id,
          reviewerId: thomasUser.id,
          revieweeId: providerUser.id,
          rating: 5,
          comment: "Sehr zufrieden mit dem Service. Sauber, gründlich und zuverlässig. Werden wir wieder buchen.",
          providerReply: "Vielen Dank für Ihre positive Bewertung! Wir freuen uns auf die weitere Zusammenarbeit.",
        }
      });

      // Review 3: Grundreinigung - 4 stars with reply
      const sarahUser = customerMap.get("sarah@test.com");
      const reviewReq3 = await prisma.serviceRequest.create({
        data: {
          customerId: sarahUser.id,
          categoryId: cleaningCat.id,
          title: "Grundreinigung",
          description: "Deep cleaning completed",
          postalCode: "10439",
          city: "Berlin",
          address: "Schönhauser Allee 78",
          lat: 52.55,
          lng: 13.42,
          status: "completed",
        }
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
        }
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
        }
      });
      await prisma.review.create({
        data: {
          bookingId: reviewBooking3.id,
          reviewerId: sarahUser.id,
          revieweeId: providerUser.id,
          rating: 4,
          comment: "Gute Reinigung insgesamt. Ein kleiner Bereich wurde übersehen, aber nach Hinweis sofort erledigt.",
          providerReply: "Danke für Ihr Feedback! Wir arbeiten ständig daran, uns zu verbessern.",
        }
      });

      // Review 4: Umzugsreinigung - 5 stars no reply
      const michaelUser = customerMap.get("michael@test.com");
      const reviewReq4 = await prisma.serviceRequest.create({
        data: {
          customerId: michaelUser.id,
          categoryId: cleaningCat.id,
          title: "Umzugsreinigung",
          description: "Move-out cleaning completed",
          postalCode: "10119",
          city: "Berlin",
          address: "Brunnenstraße 20",
          lat: 52.53,
          lng: 13.4,
          status: "completed",
        }
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
        }
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
        }
      });
      await prisma.review.create({
        data: {
          bookingId: reviewBooking4.id,
          reviewerId: michaelUser.id,
          revieweeId: providerUser.id,
          rating: 5,
          comment: "Perfekt! Die Wohnung war wie neu als sie fertig waren. Habe meine Kaution vollständig zurückbekommen.",
          providerReply: null,
        }
      });

      console.log("✅ Created completed bookings with reviews (4 reviews)");
    }
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
      }
    });
    console.log(`✅ Updated provider rating: ${reviewStats._avg.rating.toFixed(1)} (${reviewStats._count.rating} reviews)`);
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
