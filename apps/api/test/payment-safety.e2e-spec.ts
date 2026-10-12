import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaService } from "../src/common/prisma/prisma.service";
import { PaymentsService } from "../src/modules/payments/payments.service";
import { PaymentAttemptsService } from "../src/modules/payments/payment-attempts.service";
import { PaymentCoordinationService } from "../src/modules/payments/payment-coordination.service";
import { PaymentOperationsService } from "../src/modules/payments/payment-operations.service";
import {
  prisma,
  resetAndSeedDatabase,
  createUserFixture,
  createProviderFixture,
  createDealFixture,
} from "./e2e-utils";

const deferred = () => {
  let resolve!: (value: any) => void;
  const promise = new Promise<any>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

describe("payment safety with PostgreSQL and independent API instances (Stripe mocked)", () => {
  const db2 = new PrismaService();
  let booking: any;
  let payment: any;
  const sessions = new Map<string, any>();
  const stripe = {
    assertEnabled: jest.fn(),
    assertEventMode: jest.fn(),
    getPaymentsMode: () => "sandbox",
    getCommissionRate: () => 0.15,
    getCheckoutUrls: () => ({
      successUrl: "http://localhost/success",
      cancelUrl: "http://localhost/cancel",
    }),
    createCheckoutSession: jest.fn(),
    retrieveCheckoutSession: jest.fn(async (id: string) => sessions.get(id)),
    createTransfer: jest.fn(),
    reverseTransfer: jest.fn(),
    createRefund: jest.fn(),
    retrievePaymentIntent: jest.fn(),
  };
  const connect = {
    ensureEligible: jest.fn(async (id: string) =>
      prisma.provider.findUniqueOrThrow({ where: { id } }),
    ),
  };
  const build = (db: any) => {
    const coordination = new PaymentCoordinationService(db);
    const attempts = new PaymentAttemptsService(
      db,
      coordination,
      stripe as any,
    );
    const operations = new PaymentOperationsService(
      db,
      coordination,
      stripe as any,
      connect as any,
    );
    const payments = new PaymentsService(
      db,
      stripe as any,
      connect as any,
      attempts,
      coordination,
      operations,
    );
    return { attempts, operations, payments };
  };
  const api1 = build(prisma);
  const api2 = build(db2);
  beforeEach(async () => {
    jest.clearAllMocks();
    sessions.clear();
    await resetAndSeedDatabase();
    const { user } = await createUserFixture({
      email: "safety-customer@example.com",
    });
    const { provider } = await createProviderFixture({
      email: "safety-provider@example.com",
    });
    const deal = await createDealFixture({
      customerId: user.id,
      providerId: provider.id,
      bookingStatus: "completion_pending",
    });
    booking = deal.booking;
    payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        customerId: user.id,
        providerId: provider.id,
        grossAmount: 15000,
        platformFeeAmount: 2250,
        providerAmount: 12750,
      },
    });
    stripe.createCheckoutSession.mockImplementation(async (params: any) => {
      const id = `cs_${params.metadata.attemptId}`;
      const session = {
        id,
        url: `https://checkout.stripe.test/${id}`,
        status: "open",
        payment_intent: `pi_${params.metadata.attemptId}`,
        metadata: params.metadata,
        amount_total: 15000,
        currency: "eur",
      };
      sessions.set(id, session);
      return session;
    });
    stripe.createTransfer.mockResolvedValue({ id: "tr_safety" });
    stripe.reverseTransfer.mockResolvedValue({ id: "rev_safety" });
    stripe.createRefund.mockResolvedValue({ id: "re_safety" });
    stripe.retrievePaymentIntent.mockResolvedValue({
      latest_charge: "ch_safety",
    });
  });
  afterAll(async () => {
    await db2.$disconnect();
    await prisma.$disconnect();
  });
  const start = () =>
    api1.payments.createCheckoutSession(booking.customerId, booking.id);
  const sessionEvent = (session: any, type: string, id: string) =>
    ({
      id,
      type,
      created: 100,
      data: {
        object: {
          ...session,
          payment_status: type.includes("completed") ? "paid" : "unpaid",
        },
      },
    }) as any;
  const dispute = (
    type = "charge.dispute.created",
    status = "needs_response",
    created = 200,
  ) =>
    ({
      id: `evt_${type}_${created}`,
      type,
      created,
      data: {
        object: {
          id: "dp_safety",
          charge: "ch_safety",
          payment_intent: payment.stripePaymentIntentId,
          status,
        },
      },
    }) as any;
  async function paid() {
    const checkout = await start();
    const session = sessions.get(checkout.checkoutUrl!.split("/").pop()!);
    await api1.payments.processWebhook(
      sessionEvent(session, "checkout.session.completed", "evt_paid"),
    );
    payment = await prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    return session;
  }
  const refund = () =>
    ({
      id: "evt_refund",
      type: "charge.refunded",
      created: 210,
      data: {
        object: {
          id: "ch_safety",
          payment_intent: payment.stripePaymentIntentId,
          amount: 15000,
          amount_refunded: 15000,
          currency: "eur",
        },
      },
    }) as any;

  it("two concurrent retries on separate instances reserve one payable session", async () => {
    const first = await start();
    sessions.get(first.checkoutUrl!.split("/").pop()!).status = "expired";
    await Promise.all([
      start(),
      api2.payments.createCheckoutSession(booking.customerId, booking.id),
    ]);
    expect(
      await prisma.paymentAttempt.count({ where: { paymentId: payment.id } }),
    ).toBe(2);
    expect(stripe.createCheckoutSession).toHaveBeenCalledTimes(2);
    expect(
      [...sessions.values()].filter((s) => s.status === "open"),
    ).toHaveLength(1);
  });
  it("stale failure cannot change a newer active session; stale collection is visible", async () => {
    const first = await start();
    const old = sessions.get(first.checkoutUrl!.split("/").pop()!);
    old.status = "expired";
    await start();
    const active = await prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    await api1.payments.processWebhook(
      sessionEvent(
        old,
        "checkout.session.async_payment_failed",
        "evt_old_fail",
      ),
    );
    expect(
      (await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }))
        .stripeCheckoutSessionId,
    ).toBe(active.stripeCheckoutSessionId);
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }))
        .paymentStatus,
    ).toBe("pending");
    await api1.payments.processWebhook(
      sessionEvent(old, "checkout.session.completed", "evt_old_paid"),
    );
    expect(
      (
        await prisma.paymentAttempt.findUniqueOrThrow({
          where: { id: first.attemptId },
        })
      ).paidAt,
    ).not.toBeNull();
    expect(
      (await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }))
        .reconciliationReason,
    ).toBe("stale_or_duplicate_collection");
    await expect(api1.operations.requestTransfer(payment.id)).rejects.toThrow();
  });
  it.each([false, true])(
    "success/failure order %s and concurrent replay preserve a single paid notification",
    async (failureFirst) => {
      const checkout = await start();
      const session = sessions.get(checkout.checkoutUrl!.split("/").pop()!);
      const success = sessionEvent(
        session,
        "checkout.session.completed",
        "evt_success",
      );
      const failure = sessionEvent(
        session,
        "checkout.session.async_payment_failed",
        "evt_failure",
      );
      await api1.payments.processWebhook(failureFirst ? failure : success);
      await api1.payments.processWebhook(failureFirst ? success : failure);
      await Promise.all([
        api1.payments.processWebhook(success),
        api2.payments.processWebhook(success),
      ]);
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }))
          .paymentStatus,
      ).toBe("paid");
      expect(
        await prisma.notification.count({
          where: { type: "payment_succeeded" },
        }),
      ).toBe(1);
    },
  );
  it.each(["dispute", "refund"])(
    "%s before transfer blocks any release",
    async (type) => {
      await paid();
      await api1.payments.processWebhook(
        type === "dispute" ? dispute() : refund(),
      );
      await expect(
        api1.operations.requestTransfer(payment.id),
      ).rejects.toThrow();
      expect(stripe.createTransfer).not.toHaveBeenCalled();
      if (type === "dispute")
        expect(await prisma.paymentDispute.count()).toBe(1);
    },
  );
  it.each(["dispute", "refund"])(
    "%s during transfer persists a reversal obligation",
    async (type) => {
      await paid();
      const gate = deferred();
      const entered = deferred();
      stripe.createTransfer.mockImplementation(async () => {
        entered.resolve(true);
        return gate.promise;
      });
      const op = await api1.operations.requestTransfer(payment.id);
      const running = api1.operations.runOperation(op.id);
      await entered.promise;
      await api2.payments.processWebhook(
        type === "dispute" ? dispute() : refund(),
      );
      gate.resolve({ id: "tr_safety" });
      await running;
      const reversal = await prisma.paymentOperation.findUniqueOrThrow({
        where: { paymentId_kind: { paymentId: payment.id, kind: "reversal" } },
      });
      await api2.operations.runOperation(reversal.id);
      expect(
        (await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }))
          .stripeTransferReversalId,
      ).toBe("rev_safety");
    },
  );
  it("dispute after transfer and reversal failure/replay recover idempotently", async () => {
    await paid();
    const transfer = await api1.operations.requestTransfer(payment.id);
    await api1.operations.runOperation(transfer.id);
    const event = dispute();
    await api1.payments.processWebhook(event);
    const op = await prisma.paymentOperation.findUniqueOrThrow({
      where: { paymentId_kind: { paymentId: payment.id, kind: "reversal" } },
    });
    stripe.reverseTransfer.mockRejectedValueOnce(
      new Error("Stripe unavailable"),
    );
    await expect(api1.operations.runOperation(op.id)).rejects.toThrow();
    await api2.payments.processWebhook(event);
    await prisma.paymentOperation.update({
      where: { id: op.id },
      data: { nextRunAt: new Date(0) },
    });
    await api2.operations.runOperation(op.id);
    expect(stripe.reverseTransfer.mock.calls[0]).toEqual(
      stripe.reverseTransfer.mock.calls[1],
    );
    expect(
      await prisma.paymentOperation.count({ where: { kind: "reversal" } }),
    ).toBe(1);
  });
  it("dispute before intent association is retained and recovered; closed wins over stale created", async () => {
    const checkout = await start();
    const session = sessions.get(checkout.checkoutUrl!.split("/").pop()!);
    const event = dispute();
    event.data.object.payment_intent = "pi_late";
    await api1.payments.processWebhook(event);
    expect(
      (
        await prisma.stripeWebhookEvent.findUniqueOrThrow({
          where: { id: event.id },
        })
      ).unresolved,
    ).toBe(true);
    await prisma.paymentAttempt.update({
      where: { id: checkout.attemptId },
      data: { stripePaymentIntentId: "pi_late" },
    });
    session.payment_intent = "pi_late";
    await prisma.stripeWebhookEvent.update({
      where: { id: event.id },
      data: { nextRunAt: new Date(0) },
    });
    await api1.payments.reconcilePendingWebhooks();
    payment.stripePaymentIntentId = "pi_late";
    expect(
      (await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }))
        .disputedAt,
    ).not.toBeNull();
    await api1.payments.processWebhook(
      dispute("charge.dispute.closed", "won", 300),
    );
    await api1.payments.processWebhook(
      dispute("charge.dispute.created", "needs_response", 250),
    );
    expect(
      (await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }))
        .disputedAt,
    ).toBeNull();
  });
  it("Stripe success with DB finalization failure recovers with identical payload/key", async () => {
    await paid();
    const op = await api1.operations.requestTransfer(payment.id);
    let fail = true;
    const coordination = new PaymentCoordinationService(prisma as any);
    const failing = {
      withPayment: (paymentId: string, callback: any) => {
        if (fail && stripe.createTransfer.mock.calls.length) {
          fail = false;
          return Promise.reject(new Error("DB write failed"));
        }
        return coordination.withPayment(paymentId, callback);
      },
    };
    const operations = new PaymentOperationsService(
      prisma as any,
      failing as any,
      stripe as any,
      connect as any,
    );
    await expect(operations.runOperation(op.id)).rejects.toThrow(
      "DB write failed",
    );
    await prisma.paymentOperation.update({
      where: { id: op.id },
      data: { leaseUntil: new Date(0) },
    });
    await api2.operations.runOperation(op.id);
    expect(stripe.createTransfer.mock.calls[0]).toEqual(
      stripe.createTransfer.mock.calls[1],
    );
    expect(
      (
        await prisma.paymentOperation.findUniqueOrThrow({
          where: { id: op.id },
        })
      ).status,
    ).toBe("succeeded");
  });
  it("completion returns pending, survives slow Stripe and reuses the operation", async () => {
    await paid();
    const requested = await api1.payments.requestCompletion(
      booking.customerId,
      booking.id,
    );
    const retry = await api2.payments.requestCompletion(
      booking.customerId,
      booking.id,
    );
    expect(retry.operationId).toBe(requested.operationId);
    expect(requested.status).toBe("pending");
    const gate = deferred();
    const entered = deferred();
    stripe.createTransfer.mockImplementation(async () => {
      entered.resolve(true);
      return gate.promise;
    });
    const running = api1.operations.runOperation(requested.operationId);
    await entered.promise;
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }))
        .status,
    ).toBe("completion_pending");
    gate.resolve({ id: "tr_safety" });
    await running;
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }))
        .status,
    ).toBe("completed");
    expect(
      (await api2.payments.requestCompletion(booking.customerId, booking.id))
        .status,
    ).toBe("succeeded");
    expect(stripe.createTransfer).toHaveBeenCalledTimes(1);
  });
  it("refund intent blocks payout before its webhook arrives and preserves customer/admin authority", async () => {
    await paid();
    await expect(
      api1.operations.requestRefund({ id: "stranger" }, booking.id),
    ).rejects.toThrow();
    const op = await api1.operations.requestRefund(
      { id: booking.customerId },
      booking.id,
    );
    await expect(api2.operations.requestTransfer(payment.id)).rejects.toThrow();
    await api1.operations.runOperation(op.id);
    expect(
      (await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }))
        .status,
    ).toBe("paid");
    const repeated = await api2.operations.requestRefund(
      { id: booking.customerId },
      booking.id,
    );
    expect(repeated.id).toBe(op.id);
    expect(stripe.createRefund).toHaveBeenCalledTimes(1);
  });
  it("refund after transfer creates one reversal; customer cannot refund a claimed transfer", async () => {
    await paid();
    const op = await api1.operations.requestTransfer(payment.id);
    await expect(
      api2.operations.requestRefund({ id: booking.customerId }, booking.id),
    ).rejects.toThrow();
    await api1.operations.runOperation(op.id);
    await api2.operations.requestRefund(
      { id: "admin", userType: "admin" },
      booking.id,
    );
    await api1.payments.processWebhook(refund());
    await api2.payments.processWebhook(refund());
    expect(
      await prisma.paymentOperation.count({ where: { kind: "reversal" } }),
    ).toBe(1);
    await api1.operations.drain();
    expect(
      (await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }))
        .transferReversedAt,
    ).not.toBeNull();
  });
  it("expired lease is recovered by another worker instance", async () => {
    await paid();
    const op = await api1.operations.requestTransfer(payment.id);
    await prisma.paymentOperation.update({
      where: { id: op.id },
      data: {
        leaseToken: "dead-worker",
        leaseUntil: new Date(0),
        firstCalledAt: new Date(),
      },
    });
    await api2.operations.drain();
    expect(
      (
        await prisma.paymentOperation.findUniqueOrThrow({
          where: { id: op.id },
        })
      ).status,
    ).toBe("succeeded");
    expect(stripe.createTransfer).toHaveBeenCalledTimes(1);
  });
  it("genuine Stripe error remains failed and completion retries cannot create a second transfer", async () => {
    await paid();
    const op = await api1.payments.requestCompletion(
      booking.customerId,
      booking.id,
    );
    stripe.createTransfer.mockRejectedValue({
      type: "StripeInvalidRequestError",
      code: "resource_missing",
    });
    await expect(
      api1.operations.runOperation(op.operationId),
    ).rejects.toBeDefined();
    await prisma.paymentOperation.update({
      where: { id: op.operationId },
      data: { nextRunAt: new Date(0) },
    });
    await api2.operations.runOperation(op.operationId);
    expect(
      (await api2.payments.requestCompletion(booking.customerId, booking.id))
        .status,
    ).toBe("failed");
    expect(stripe.createTransfer).toHaveBeenCalledTimes(1);
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }))
        .status,
    ).toBe("completion_pending");
  });
  it("an intent failure leaves open Checkout reusable, while confirmed async failure permits one retry", async () => {
    const checkout = await start();
    const session = sessions.get(checkout.checkoutUrl!.split("/").pop()!);
    await api1.payments.processWebhook({
      id: "evt_intent_failed",
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: session.payment_intent,
          metadata: session.metadata,
          amount: 15000,
          currency: "eur",
        },
      },
    } as any);
    const reused = await start();
    expect(reused.attemptId).toBe(checkout.attemptId);
    expect(stripe.createCheckoutSession).toHaveBeenCalledTimes(1);
    session.status = "complete";
    await api1.payments.processWebhook(
      sessionEvent(
        session,
        "checkout.session.async_payment_failed",
        "evt_async_failed",
      ),
    );
    const next = await start();
    expect(next.attemptId).not.toBe(checkout.attemptId);
    expect(stripe.createCheckoutSession).toHaveBeenCalledTimes(2);
  });
  it("rejects wrong amount, ownership metadata and attempt object identity", async () => {
    const checkout = await start();
    const session = sessions.get(checkout.checkoutUrl!.split("/").pop()!);
    for (const changed of [
      { ...session, amount_total: 1 },
      { ...session, metadata: { ...session.metadata, customerId: "other" } },
      { ...session, id: "cs_other" },
    ]) {
      await expect(
        api1.payments.processWebhook(
          sessionEvent(
            changed,
            "checkout.session.completed",
            `evt_invalid_${changed.id}_${changed.amount_total}_${changed.metadata.customerId}`,
          ),
        ),
      ).rejects.toThrow();
    }
    expect(
      (await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }))
        .status,
    ).toBe("pending");
  });

  it("backfills legacy object bindings and accepts an exact-ID legacy event", async () => {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        stripeCheckoutSessionId: "cs_legacy",
        stripePaymentIntentId: "pi_legacy",
        stripeChargeId: "ch_legacy",
        status: "paid",
        paidAt: new Date(),
      },
    });
    const migration = readFileSync(
      join(
        __dirname,
        "../prisma/migrations/20261012130000_payment_safety/migration.sql",
      ),
      "utf8",
    );
    const backfill = migration.slice(
      migration.indexOf("-- Preserve legacy"),
      migration.indexOf("-- Existing disputes"),
    );
    for (const sql of backfill
      .replace(/^--.*$/gm, "")
      .split(";")
      .filter((statement) => statement.trim()))
      await prisma.$executeRawUnsafe(sql);
    const legacy = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: `legacy:${payment.id}` },
    });
    expect(legacy.stripePaymentIntentId).toBe("pi_legacy");
    expect(
      (await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }))
        .paidAttemptId,
    ).toBe(legacy.id);
    await api1.payments.processWebhook({
      id: "evt_legacy_failure",
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: "pi_legacy",
          amount: 15000,
          currency: "eur",
          metadata: {},
        },
      },
    } as any);
    expect(
      (await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }))
        .status,
    ).toBe("paid");
  });
});
