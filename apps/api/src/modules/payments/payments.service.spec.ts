import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { PaymentAttemptsService } from "./payment-attempts.service";

describe("payment invariants", () => {
  const prisma = {
    booking: { findUnique: jest.fn(), update: jest.fn() },
    payment: { update: jest.fn() },
    paymentAttempt: { update: jest.fn() },
  };
  const stripe = {
    assertEnabled: jest.fn(),
    assertEventMode: jest.fn(),
    getPaymentsMode: () => "sandbox",
    getCommissionRate: () => 0.15,
  };
  const service = new PaymentsService(
    prisma as any,
    stripe as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
  beforeEach(() => jest.clearAllMocks());
  it("preserves integer cent amounts and commission", () => {
    expect(service.calculateAmounts(123.45)).toEqual({
      grossAmount: 12345,
      platformFeeAmount: 1852,
      providerAmount: 10493,
    });
    expect(() => service.calculateAmounts(0.1)).toThrow(BadRequestException);
  });
  it("checks ownership before external payment calls", async () => {
    prisma.booking.findUnique.mockResolvedValue({ customerId: "owner" });
    await expect(
      service.createCheckoutSession("other", "booking"),
    ).rejects.toThrow(ForbiddenException);
  });
  const attempts = new PaymentAttemptsService(
    prisma as any,
    {} as any,
    stripe as any,
  );
  const payment = {
    id: "payment",
    bookingId: "booking",
    activeAttemptId: "new",
    paidAttemptId: null,
    status: "pending",
  };
  it("does not let a stale failed session overwrite the active attempt", async () => {
    expect(
      await attempts.apply(
        prisma as any,
        { payment, attempt: { id: "old", paidAt: null } } as any,
        "failed",
        { sessionId: "cs_old" },
      ),
    ).toBeNull();
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(prisma.paymentAttempt.update).toHaveBeenCalled();
  });
  it("records stale collection and flags reconciliation", async () => {
    expect(
      await attempts.apply(
        prisma as any,
        { payment, attempt: { id: "old", paidAt: null } } as any,
        "paid",
        { intentId: "pi_old" },
      ),
    ).toBeNull();
    expect(prisma.paymentAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paidAt: expect.any(Date) }),
      }),
    );
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { reconciliationReason: "stale_or_duplicate_collection" },
      }),
    );
  });
  it("success is absorbing when failure arrives later", async () => {
    expect(
      await attempts.apply(
        prisma as any,
        {
          payment: { ...payment, status: "paid" },
          attempt: { id: "new", paidAt: new Date() },
        } as any,
        "failed",
        { intentId: "pi_new" },
      ),
    ).toBeNull();
    expect(prisma.paymentAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "paid" }),
      }),
    );
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });
});
