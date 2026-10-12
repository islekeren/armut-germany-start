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
      findFirst: jest.fn(),
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
    retrievePaymentIntent: jest.fn(),
    createTransfer: jest.fn(),
    reverseTransfer: jest.fn(),
    createRefund: jest.fn(),
    constructWebhookEvent: jest.fn(),
  };

  const stripeConnectService = {
    syncProvider: jest.fn(),
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
      stripePayoutsEnabled: true,
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
    stripeChargeId: null,
    stripeTransferId: null,
    stripeTransferReversalId: null,
    transferredAt: null,
    transferReversedAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    stripeService.getCommissionRate.mockReturnValue(0.15);
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    stripeConnectService.syncProvider.mockResolvedValue({
      stripeAccountId: "acct_test",
      stripeOnboardingStatus: "ready",
      stripeTransfersEnabled: true,
      stripePayoutsEnabled: true,
    });
    service = new PaymentsService(
      prisma as any,
      stripeService as any,
      stripeConnectService as any,
    );
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

  it("creates a separate-charge Checkout Session without an automatic transfer", async () => {
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
          transfer_group: "booking:booking-1",
        }),
      }),
      "checkout-session:payment-1:0",
    );
    const params = stripeService.createCheckoutSession.mock.calls[0][0];
    expect(params.payment_intent_data).not.toHaveProperty(
      "application_fee_amount",
    );
    expect(params.payment_intent_data).not.toHaveProperty("transfer_data");
  });

  it("releases the provider share once after confirmed payment", async () => {
    prisma.payment.findUnique.mockResolvedValue({
      ...payment,
      status: "paid",
      stripePaymentIntentId: "pi_1",
      stripeChargeId: "ch_1",
      provider: booking.provider,
    });
    stripeService.createTransfer.mockResolvedValue({ id: "tr_1" });
    prisma.payment.update.mockResolvedValue({
      ...payment,
      stripeTransferId: "tr_1",
    });

    await service.releaseProviderFunds(booking.id);

    expect(stripeService.createTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: payment.providerAmount,
        currency: "eur",
        destination: "acct_test",
        source_transaction: "ch_1",
        transfer_group: "booking:booking-1",
      }),
      "provider-transfer:payment-1",
    );
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: payment.id },
      data: expect.objectContaining({
        stripeChargeId: "ch_1",
        stripeTransferId: "tr_1",
        transferredAt: expect.any(Date),
      }),
    });
  });

  it("does not create a second provider transfer", async () => {
    prisma.payment.findUnique.mockResolvedValue({
      ...payment,
      status: "paid",
      stripePaymentIntentId: "pi_1",
      stripeChargeId: "ch_1",
      stripeTransferId: "tr_existing",
      transferredAt: new Date(),
      provider: booking.provider,
    });

    await service.releaseProviderFunds(booking.id);

    expect(stripeService.createTransfer).not.toHaveBeenCalled();
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

  it("reverses a released provider transfer after a full refund", async () => {
    prisma.stripeWebhookEvent.findUnique.mockResolvedValue(null);
    prisma.stripeWebhookEvent.create.mockResolvedValue({ id: "evt_refund" });
    prisma.stripeWebhookEvent.update.mockResolvedValue({ id: "evt_refund" });
    prisma.payment.findUnique.mockResolvedValue({
      ...payment,
      status: "paid",
      stripePaymentIntentId: "pi_1",
      stripeChargeId: "ch_1",
      stripeTransferId: "tr_1",
      stripeTransferReversalId: null,
      transferredAt: new Date(),
      transferReversedAt: null,
      provider: { userId: "provider-user-1" },
    });
    stripeService.reverseTransfer.mockResolvedValue({ id: "trr_1" });
    prisma.payment.update.mockResolvedValue(payment);
    prisma.booking.update.mockResolvedValue(booking);

    await service.processWebhook({
      id: "evt_refund",
      type: "charge.refunded",
      data: {
        object: {
          id: "ch_1",
          amount: payment.grossAmount,
          amount_refunded: payment.grossAmount,
          currency: payment.currency,
          payment_intent: "pi_1",
        },
      },
    } as any);

    expect(stripeService.reverseTransfer).toHaveBeenCalledWith(
      "tr_1",
      expect.objectContaining({
        metadata: expect.objectContaining({ reason: "refund" }),
      }),
      "provider-transfer-reversal:payment-1",
    );
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: payment.id },
      data: expect.objectContaining({
        stripeTransferReversalId: "trr_1",
        transferReversedAt: expect.any(Date),
      }),
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
  describe("webhook events that are not ours", () => {
    beforeEach(() => {
      prisma.stripeWebhookEvent.findUnique.mockResolvedValue(null);
      prisma.stripeWebhookEvent.create.mockResolvedValue({ id: "evt_x" });
      prisma.stripeWebhookEvent.update.mockResolvedValue({ id: "evt_x" });
    });

    it("acknowledges a payment intent without platform metadata", async () => {
      await expect(
        service.processWebhook({
          id: "evt_x",
          type: "payment_intent.succeeded",
          data: { object: { id: "pi_other", amount: 100, currency: "eur", metadata: {} } },
        } as any),
      ).resolves.toEqual({ received: true, duplicate: false });
      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(prisma.stripeWebhookEvent.update).toHaveBeenCalledWith({
        where: { id: "evt_x" },
        data: { processedAt: expect.any(Date) },
      });
    });

    it("acknowledges a refund for an unknown payment intent", async () => {
      prisma.payment.findUnique.mockResolvedValue(null);
      await expect(
        service.processWebhook({
          id: "evt_x",
          type: "charge.refunded",
          data: {
            object: { id: "ch_x", amount: 100, amount_refunded: 100, currency: "eur", payment_intent: "pi_unknown" },
          },
        } as any),
      ).resolves.toEqual({ received: true, duplicate: false });
    });
  });

  describe("disputes", () => {
    const paidPayment = {
      ...payment,
      status: "paid",
      stripePaymentIntentId: "pi_1",
      stripeChargeId: "ch_1",
      disputedAt: null,
    };

    beforeEach(() => {
      prisma.stripeWebhookEvent.findUnique.mockResolvedValue(null);
      prisma.stripeWebhookEvent.create.mockResolvedValue({ id: "evt_d" });
      prisma.stripeWebhookEvent.update.mockResolvedValue({ id: "evt_d" });
    });

    it("holds the payout when a dispute arrives before any transfer", async () => {
      prisma.payment.findFirst.mockResolvedValue(paidPayment);
      prisma.payment.update.mockResolvedValue(paidPayment);

      await service.processWebhook({
        id: "evt_d",
        type: "charge.dispute.created",
        data: { object: { id: "dp_1", charge: "ch_1", payment_intent: "pi_1" } },
      } as any);

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: payment.id },
        data: { disputedAt: expect.any(Date) },
      });
      expect(stripeService.reverseTransfer).not.toHaveBeenCalled();
    });

    it("refuses to release funds while disputed", async () => {
      prisma.payment.findUnique.mockResolvedValue({
        ...paidPayment,
        disputedAt: new Date(),
        provider: booking.provider,
      });

      await expect(service.releaseProviderFunds(booking.id)).rejects.toThrow(
        ConflictException,
      );
      expect(stripeService.createTransfer).not.toHaveBeenCalled();
    });

    it("lifts the hold when the dispute is won", async () => {
      prisma.payment.findFirst.mockResolvedValue({
        ...paidPayment,
        disputedAt: new Date(),
      });
      prisma.payment.update.mockResolvedValue(paidPayment);

      await service.processWebhook({
        id: "evt_d",
        type: "charge.dispute.closed",
        data: { object: { id: "dp_1", status: "won", charge: "ch_1", payment_intent: "pi_1" } },
      } as any);

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: payment.id },
        data: { disputedAt: null },
      });
    });

    it("keeps the hold when the dispute is lost", async () => {
      await service.processWebhook({
        id: "evt_d",
        type: "charge.dispute.closed",
        data: { object: { id: "dp_1", status: "lost", charge: "ch_1" } },
      } as any);

      expect(prisma.payment.update).not.toHaveBeenCalled();
    });
  });

  describe("requestRefund", () => {
    const paidPayment = {
      ...payment,
      status: "paid",
      stripePaymentIntentId: "pi_1",
      booking: { status: "confirmed" },
    };

    it("refunds the customer's own paid booking once via an idempotency key", async () => {
      prisma.payment.findUnique.mockResolvedValue(paidPayment);
      stripeService.createRefund.mockResolvedValue({ id: "re_1", status: "succeeded" });

      await expect(
        service.requestRefund({ id: "customer-1", userType: "customer" }, "booking-1"),
      ).resolves.toEqual({ refundId: "re_1", status: "succeeded" });
      expect(stripeService.createRefund).toHaveBeenCalledWith(
        expect.objectContaining({ payment_intent: "pi_1" }),
        "payment-refund:payment-1",
      );
      // State only changes once the signed webhook arrives.
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it("rejects other customers", async () => {
      prisma.payment.findUnique.mockResolvedValue(paidPayment);
      await expect(
        service.requestRefund({ id: "someone-else", userType: "customer" }, "booking-1"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("rejects unpaid and already refunded payments", async () => {
      prisma.payment.findUnique.mockResolvedValueOnce({ ...paidPayment, status: "pending" });
      await expect(
        service.requestRefund({ id: "customer-1", userType: "customer" }, "booking-1"),
      ).rejects.toThrow(BadRequestException);

      prisma.payment.findUnique.mockResolvedValueOnce({ ...paidPayment, status: "refunded" });
      await expect(
        service.requestRefund({ id: "customer-1", userType: "customer" }, "booking-1"),
      ).rejects.toThrow(ConflictException);
    });

    it("lets only admins refund after the provider transfer was released", async () => {
      const released = { ...paidPayment, stripeTransferId: "tr_1" };
      prisma.payment.findUnique.mockResolvedValue(released);
      stripeService.createRefund.mockResolvedValue({ id: "re_2", status: "pending" });

      await expect(
        service.requestRefund({ id: "customer-1", userType: "customer" }, "booking-1"),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.requestRefund({ id: "admin-1", userType: "admin" }, "booking-1"),
      ).resolves.toEqual({ refundId: "re_2", status: "pending" });
    });
  });
  describe("live provider readiness", () => {
    it("blocks checkout when Stripe reports the account is no longer ready", async () => {
      prisma.booking.findUnique.mockResolvedValue(booking);
      stripeConnectService.syncProvider.mockResolvedValue({
        stripeAccountId: "acct_test",
        stripeOnboardingStatus: "restricted",
        stripeTransfersEnabled: false,
        stripePayoutsEnabled: true,
      });

      await expect(
        service.createCheckoutSession("customer-1", booking.id),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.payment.upsert).not.toHaveBeenCalled();
    });

    it("blocks the provider transfer when Stripe reports the account is no longer ready", async () => {
      prisma.payment.findUnique.mockResolvedValue({
        ...payment,
        status: "paid",
        stripePaymentIntentId: "pi_1",
        stripeChargeId: "ch_1",
        provider: booking.provider,
      });
      stripeConnectService.syncProvider.mockResolvedValue({
        stripeAccountId: "acct_test",
        stripeOnboardingStatus: "pending",
        stripeTransfersEnabled: true,
        stripePayoutsEnabled: false,
      });

      await expect(service.releaseProviderFunds(booking.id)).rejects.toThrow(
        BadRequestException,
      );
      expect(stripeService.createTransfer).not.toHaveBeenCalled();
    });
  });

  describe("transfer reversal outside the transaction", () => {
    it("keeps the event unprocessed when the reversal fails so Stripe redelivers it", async () => {
      prisma.stripeWebhookEvent.findUnique.mockResolvedValue(null);
      prisma.stripeWebhookEvent.create.mockResolvedValue({ id: "evt_r" });
      prisma.payment.findUnique.mockResolvedValue({
        ...payment,
        status: "paid",
        stripePaymentIntentId: "pi_1",
        stripeTransferId: "tr_1",
        provider: { userId: "provider-user-1" },
      });
      prisma.payment.update.mockResolvedValue(payment);
      prisma.booking.update.mockResolvedValue(booking);
      stripeService.reverseTransfer.mockRejectedValue(new Error("stripe down"));

      await expect(
        service.processWebhook({
          id: "evt_r",
          type: "charge.refunded",
          data: {
            object: {
              id: "ch_1",
              amount: payment.grossAmount,
              amount_refunded: payment.grossAmount,
              currency: payment.currency,
              payment_intent: "pi_1",
            },
          },
        } as any),
      ).rejects.toThrow("stripe down");

      expect(prisma.stripeWebhookEvent.update).not.toHaveBeenCalled();
    });

    it("marks the event processed only after the reversal is stored", async () => {
      prisma.stripeWebhookEvent.findUnique.mockResolvedValue(null);
      prisma.stripeWebhookEvent.create.mockResolvedValue({ id: "evt_r" });
      prisma.stripeWebhookEvent.update.mockResolvedValue({ id: "evt_r" });
      prisma.payment.findUnique.mockResolvedValue({
        ...payment,
        status: "paid",
        stripePaymentIntentId: "pi_1",
        stripeTransferId: "tr_1",
        provider: { userId: "provider-user-1" },
      });
      prisma.payment.update.mockResolvedValue(payment);
      prisma.booking.update.mockResolvedValue(booking);
      stripeService.reverseTransfer.mockResolvedValue({ id: "trr_9" });

      await service.processWebhook({
        id: "evt_r",
        type: "charge.refunded",
        data: {
          object: {
            id: "ch_1",
            amount: payment.grossAmount,
            amount_refunded: payment.grossAmount,
            currency: payment.currency,
            payment_intent: "pi_1",
          },
        },
      } as any);

      const order = (fn: jest.Mock) => fn.mock.invocationCallOrder.at(-1)!;
      expect(prisma.stripeWebhookEvent.update).toHaveBeenCalledTimes(1);
      expect(order(stripeService.reverseTransfer)).toBeLessThan(
        order(prisma.stripeWebhookEvent.update),
      );
    });
  });
});
