import { ConflictException, NotFoundException } from "@nestjs/common";
import { randomBytes } from "crypto";
import type { PrismaService } from "../../common/prisma/prisma.service";

const ACTIVE_BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "in_progress",
  "completion_pending",
] as const;

/**
 * Deletes an account by anonymising it instead of removing the row.
 *
 * A hard delete cascaded into the other party's bookings, quotes, reviews and
 * messages (and would remove records needed for bookkeeping once payments
 * exist). Instead personal data is wiped, the account can no longer log in,
 * open requests and pending quotes are closed, and the provider profile is
 * hidden. Shared history stays, attributed to "Gelöschter Nutzer".
 *
 * Refuses while the account still has active bookings, so nobody is left
 * with a job whose counterpart vanished.
 */
export async function anonymizeUserAccount(
  prisma: PrismaService,
  userId: string,
) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: { provider: { select: { id: true } } },
  });

  if (!user) {
    throw new NotFoundException("User not found");
  }

  const providerId = user.provider?.id;
  const activeBookings = await prisma.booking.count({
    where: {
      status: { in: [...ACTIVE_BOOKING_STATUSES] },
      OR: [
        { customerId: userId },
        ...(providerId ? [{ providerId }] : []),
      ],
    },
  });

  if (activeBookings > 0) {
    throw new ConflictException(
      "Account has active bookings. Complete or cancel them before deleting the account.",
    );
  }

  const deletedAt = new Date();

  await prisma.$transaction([
    // Customer side: close open requests and their pending quotes.
    prisma.quote.updateMany({
      where: { customerId: userId, status: "pending" },
      data: { status: "rejected" },
    }),
    prisma.serviceRequest.updateMany({
      where: { customerId: userId, status: { in: ["open", "in_progress"] } },
      data: { status: "cancelled" },
    }),
    ...(providerId
      ? [
          // Provider side: retract pending offers and hide the profile.
          prisma.quote.updateMany({
            where: { providerId, status: "pending" },
            data: { status: "expired" },
          }),
          prisma.service.updateMany({
            where: { providerId },
            data: { isActive: false },
          }),
          prisma.providerProfile.updateMany({
            where: { providerId },
            data: {
              headline: null,
              bio: null,
              addressLine1: null,
              website: null,
              coverImage: null,
              galleryImages: [],
            },
          }),
          prisma.provider.update({
            where: { id: providerId },
            data: {
              isApproved: false,
              companyName: null,
              description: "",
              taxId: null,
            },
          }),
        ]
      : []),
    prisma.notification.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        // Frees the address for a new registration; the random password
        // hash can never match, and deletedAt blocks token use.
        email: `deleted-${userId}@deleted.invalid`,
        password: `deleted:${randomBytes(32).toString("hex")}`,
        firstName: "Gelöschter",
        lastName: "Nutzer",
        phone: null,
        profileImage: null,
        isVerified: false,
        gdprConsent: false,
        deletedAt,
      },
    }),
  ]);

  return { id: userId, deletedAt };
}
