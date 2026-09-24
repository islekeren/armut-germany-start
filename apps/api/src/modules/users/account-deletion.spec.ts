import { ConflictException, NotFoundException } from "@nestjs/common";
import { anonymizeUserAccount } from "./account-deletion";

describe("anonymizeUserAccount", () => {
  const prisma = {
    user: { findFirst: jest.fn(), update: jest.fn() },
    booking: { count: jest.fn() },
    quote: { updateMany: jest.fn() },
    serviceRequest: { updateMany: jest.fn() },
    service: { updateMany: jest.fn() },
    providerProfile: { updateMany: jest.fn() },
    provider: { update: jest.fn() },
    notification: { deleteMany: jest.fn() },
    $transaction: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockResolvedValue([]);
  });

  it("refuses while the account has active bookings", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "u1", provider: null });
    prisma.booking.count.mockResolvedValue(1);

    await expect(anonymizeUserAccount(prisma as any, "u1")).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects unknown or already deleted accounts", async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(anonymizeUserAccount(prisma as any, "u1")).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u1", deletedAt: null } }),
    );
  });

  it("anonymises a customer and closes their open requests", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "u1", provider: null });
    prisma.booking.count.mockResolvedValue(0);

    await anonymizeUserAccount(prisma as any, "u1");

    expect(prisma.serviceRequest.updateMany).toHaveBeenCalledWith({
      where: { customerId: "u1", status: { in: ["open", "in_progress"] } },
      data: { status: "cancelled" },
    });
    const userUpdate = prisma.user.update.mock.calls[0][0];
    expect(userUpdate.where).toEqual({ id: "u1" });
    expect(userUpdate.data).toEqual(
      expect.objectContaining({
        email: "deleted-u1@deleted.invalid",
        firstName: "Gelöschter",
        lastName: "Nutzer",
        phone: null,
        profileImage: null,
        deletedAt: expect.any(Date),
      }),
    );
    expect(prisma.provider.update).not.toHaveBeenCalled();
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
    });
  });

  it("hides the provider profile and retracts pending quotes", async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: "u2",
      provider: { id: "p1" },
    });
    prisma.booking.count.mockResolvedValue(0);

    await anonymizeUserAccount(prisma as any, "u2");

    expect(prisma.booking.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        OR: [{ customerId: "u2" }, { providerId: "p1" }],
      }),
    });
    expect(prisma.quote.updateMany).toHaveBeenCalledWith({
      where: { providerId: "p1", status: "pending" },
      data: { status: "expired" },
    });
    expect(prisma.provider.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: expect.objectContaining({ isApproved: false, companyName: null }),
    });
    expect(prisma.service.updateMany).toHaveBeenCalledWith({
      where: { providerId: "p1" },
      data: { isActive: false },
    });
  });
});
