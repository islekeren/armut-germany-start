import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

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
  for (const category of categories) {
    const existing = await prisma.category.findUnique({
      where: { slug: category.slug },
    });

    if (!existing) {
      await prisma.category.create({
        data: category,
      });
      console.log(`✅ Created category: ${category.nameEn}`);
    } else {
      console.log(`⏭️ Category already exists: ${category.nameEn}`);
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
