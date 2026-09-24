/**
 * Promote an existing account to admin so it can approve providers.
 *
 *   npm run admin:grant --workspace=api -- someone@example.com
 *
 * Admins cannot be created through the public API on purpose; run this once
 * against the target database (DATABASE_URL) after the person has registered.
 */
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const email = process.argv[2]?.trim();
  if (!email) {
    console.error("Usage: npm run admin:grant -- <email>");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (!user) {
      console.error(`No user with email ${email}. Register the account first.`);
      process.exit(1);
    }
    if (user.userType === "provider") {
      console.error(`${email} is a provider account; use a separate account for admin work.`);
      process.exit(1);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { userType: "admin" },
    });
    console.log(`${email} is now an admin.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
