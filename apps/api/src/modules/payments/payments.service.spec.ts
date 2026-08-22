import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { PaymentsService } from "./payments.service";

describe("PaymentsService", () => {
  const prisma = {
    booking: { findUnique: jest.fn(), update: jest.fn() },
    payment: {
      upsert: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    notification: { createMany: jest.fn() },
    stripeWebhookEvent: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const stripeService = {
    getCommissionRate: jest.fn(() => 0.15),
    getCheckoutUrls: jest.fn(() => ({
      successUrl: "http://localhost/success",
      cancelUrl: "http://localhost/cancel",
    })),
    retrieveCheckoutSession: jest.fn(),
    expireCheckoutSession: jest.fn(),
    createCheckoutSession: jest.fn(),
    constructWebhookEvent: jest.fn(),
  };

  let service: PaymentsService;

  const booking = {
    id: "booking-1",
    customerId: "customer-1",
    providerId: "provider-1",
    status: "confirmed",
    paymentStatus: "pending",
    totalPrice: 123.45,
    customer: { email: "customer@example.com" },
    provider: {
      id: "provider-1",
      userId: "provider-user-1",
      stripeAccountId: "acct_test",
      stripeOnboardingStatus: "ready",
      stripeTransfersEnabled: true,
    },
    quote: {
      status: "accepted",
      request: { title: "Apartment cleaning" },
    },
  };

  const payment = {
    id: "payment-1",
    bookingId: "booking-1",
    providerId: "provider-1",
    customerId: "customer-1",
    grossAmount: 12345,
    platformFeeAmount: 1852,
    providerAmount: 10493,
    currency: "eur",
    status: "pending",
    checkoutAttempt: 0,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    stripeService.getCommissionRate.mockReturnValue(0.15);
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    service = new PaymentsService(prisma as any, stripeService as any);
  });

  it("calculates integer cent amounts and commission", () => {
    expect(service.calculateAmounts(123.45)).toEqual({
      grossAmount: 12345,
      platformFeeAmount: 1852,
      providerAmount: 10493,
    });
    expect(() => service.calculateAmounts(0.1)).toThrow(BadRequestException);
  });

  it("enforces booking ownership", async () => {
    prisma.booking.findUnique.mockResolvedValue(booking);
    await expect(
      service.createCheckoutSession("another-customer", booking.id),
    ).rejects.toThrow(ForbiddenException);
  });

  it("blocks checkout until provider transfers are ready", async () => {
    prisma.booking.findUnique.mockResolvedValue({
      ...booking,
      provider: { ...booking.provider, stripeTransfersEnabled: false },
    });
    await expect(
      service.createCheckoutSession(booking.customerId, booking.id),
    ).rejects.toThrow(BadRequestException);
  });

  it("reuses an existing open Checkout Session", async () => {
    prisma.booking.findUnique.mockResolvedValue(booking);
    prisma.payment.upsert.mockResolvedValue({
      ...payment,
      stripeCheckoutSessionId: "cs_open",
    });
    stripeService.retrieveCheckoutSession.mockResolvedValue({
      id: "cs_open",
      status: "open",
      url: "https://checkout.stripe.test/session",
    });

    await expect(
      service.createCheckoutSession(booking.customerId, booking.id),
    ).resolves.toEqual({
      checkoutUrl: "https://checkout.stripe.test/session",
      paymentId: payment.id,
      reused: true,
    });
    expect(stripeService.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("creates a new Checkout Session after an asynchronous payment fails", async () => {
    prisma.booking.findUnique.mockResolvedValue({
      ...booking,
      paymentStatus: "failed",
    });
    prisma.payment.upsert.mockResolvedValue({
      ...payment,
      status: "failed",
      failedAt: new Date(),
      stripeCheckoutSessionId: "cs_failed",
    });
    stripeService.retrieveCheckoutSession.mockResolvedValue({
      id: "cs_failed",
      status: "complete",
      url: null,
    });
    prisma.payment.update
      .mockResolvedValueOnce({
        ...payment,
        status: "pending",
        checkoutAttempt: 1,
      })
      .mockResolvedValueOnce(payment);
    stripeService.createCheckoutSession.mockResolvedValue({
      id: "cs_retry",
      url: "https://checkout.stripe.test/retry",
      payment_intent: null,
    });

    await expect(
      service.createCheckoutSession(booking.customerId, booking.id),
    ).resolves.toEqual({
      checkoutUrl: "https://checkout.stripe.test/retry",
      paymentId: payment.id,
      reused: false,
    });
    expect(stripeService.expireCheckoutSession).not.toHaveBeenCalled();
    expect(stripeService.createCheckoutSession).toHaveBeenCalledWith(
      expect.any(Object),
      "checkout-session:payment-1:1",
    );
  });

  it("creates a destination-charge Checkout Session", async () => {
    prisma.booking.findUnique.mockResolvedValue(booking);
    prisma.payment.upsert.mockResolvedValue(payment);
    prisma.payment.update.mockResolvedValue(payment);
    stripeService.createCheckoutSession.mockResolvedValue({
      id: "cs_new",
      url: "https://checkout.stripe.test/new",
      payment_intent: null,
    });

    await service.createCheckoutSession(booking.customerId, booking.id);

    expect(stripeService.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        payment_intent_data: expect.objectContaining({
          application_fee_amount: 1852,
          transfer_data: { destination: "acct_test" },
        }),
      }),
      "checkout-session:payment-1:0",
    );
  });

  it("rejects an already paid payment", async () => {
    prisma.booking.findUnique.mockResolvedValue(booking);
    prisma.payment.upsert.mockResolvedValue({ ...payment, status: "paid" });
    await expect(
      service.createCheckoutSession(booking.customerId, booking.id),
    ).rejects.toThrow(ConflictException);
  });

  it("processes a paid webhook once and updates booking atomically", async () => {
    prisma.stripeWebhookEvent.findUnique.mockResolvedValue(null);
    prisma.stripeWebhookEvent.create.mockResolvedValue({ id: "evt_1" });
    prisma.stripeWebhookEvent.update.mockResolvedValue({ id: "evt_1" });
    prisma.payment.findUnique.mockResolvedValue({
      ...payment,
      provider: { userId: "provider-user-1" },
    });
    prisma.payment.update.mockResolvedValue(payment);
    prisma.booking.update.mockResolvedValue(booking);
    prisma.notification.createMany.mockResolvedValue({ count: 2 });

    const event = {
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_paid",
          amount_total: 12345,
          currency: "eur",
          payment_status: "paid",
          payment_intent: "pi_1",
          metadata: {
            paymentId: payment.id,
            bookingId: payment.bookingId,
            providerId: payment.providerId,
            customerId: payment.customerId,
          },
        },
      },
    } as any;

    await expect(service.processWebhook(event)).resolves.toEqual({
      received: true,
      duplicate: false,
    });
    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: payment.bookingId },
      data: { paymentStatus: "paid" },
    });
    expect(prisma.notification.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.stripeWebhookEvent.update).toHaveBeenCalledWith({
      where: { id: "evt_1" },
      data: { processedAt: expect.any(Date) },
    });
  });

  it("short-circuits an already processed webhook event", async () => {
    prisma.stripeWebhookEvent.findUnique.mockResolvedValue({
      id: "evt_duplicate",
      processedAt: new Date(),
    });
    await expect(
      service.processWebhook({ id: "evt_duplicate" } as any),
    ).resolves.toEqual({ received: true, duplicate: true });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
