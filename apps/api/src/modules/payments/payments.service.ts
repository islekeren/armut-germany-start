import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PaymentStatus, Prisma } from "@prisma/client";
import Stripe from "stripe";
import { PrismaService } from "../../common/prisma/prisma.service";
import { StripeConnectService } from "./stripe-connect.service";
import { StripeService } from "./stripe.service";
import { PaymentAttemptsService, objectId } from "./payment-attempts.service";
import { PaymentOperationsService } from "./payment-operations.service";
import { PaymentCoordinationService } from "./payment-coordination.service";

const MINIMUM_EUR_AMOUNT = 50;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly stripeConnectService: StripeConnectService,
    private readonly attempts: PaymentAttemptsService,
    private readonly coordination: PaymentCoordinationService,
    private readonly operations: PaymentOperationsService,
  ) {}

  calculateAmounts(totalPrice: number) {
    const grossAmount = Math.round(totalPrice * 100);
    if (
      !Number.isSafeInteger(grossAmount) ||
      grossAmount < MINIMUM_EUR_AMOUNT
    ) {
      throw new BadRequestException("Booking amount must be at least EUR 0.50");
    }

    const platformFeeAmount = Math.round(
      grossAmount * this.stripeService.getCommissionRate(),
    );
    return {
      grossAmount,
      platformFeeAmount,
      providerAmount: grossAmount - platformFeeAmount,
    };
  }

  async createCheckoutSession(userId: string, bookingId: string) {
    this.stripeService.assertEnabled();
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: { select: { email: true } },
        provider: true,
        quote: {
          include: {
            request: { select: { title: true } },
          },
        },
      },
    });

    if (!booking) throw new NotFoundException("Booking not found");
    if (booking.customerId !== userId) {
      throw new ForbiddenException("Not authorized to pay for this booking");
    }
    if (["cancelled", "completed"].includes(booking.status)) {
      throw new BadRequestException("Booking cannot be paid at this stage");
    }
    if (booking.quote.status !== "accepted") {
      throw new BadRequestException("Quote must still be accepted");
    }
    await this.stripeConnectService.ensureEligible(booking.providerId);
    if (["paid", "refunded"].includes(booking.paymentStatus)) {
      throw new ConflictException("Booking payment is already finalized");
    }

    const amounts = this.calculateAmounts(booking.totalPrice);
    const payment = await this.prisma.payment.upsert({
      where: { bookingId: booking.id },
      create: {
        bookingId: booking.id,
        providerId: booking.providerId,
        customerId: booking.customerId,
        ...amounts,
        currency: "eur",
        status: "pending",
      },
      update: {},
    });

    if (["paid", "refunded"].includes(payment.status)) {
      throw new ConflictException("Booking payment is already finalized");
    }

    const metadata = {
      bookingId: booking.id,
      paymentId: payment.id,
      providerId: booking.providerId,
      customerId: booking.customerId,
    };
    const urls = this.stripeService.getCheckoutUrls(booking.id);
    return this.attempts.createCheckout(payment.id, {
      mode: "payment",
      integration_identifier: "armut_checkout_kdptwzmx",
      customer_email: booking.customer.email,
      success_url: urls.successUrl,
      cancel_url: urls.cancelUrl,
      metadata,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: payment.grossAmount,
            product_data: {
              name: booking.quote.request.title.slice(0, 120),
            },
          },
        },
      ],
      payment_intent_data: {
        transfer_group: `booking:${booking.id}`,
        metadata,
      },
    });
  }

  constructWebhookEvent(rawBody: Buffer, signature: string) {
    if (!rawBody?.length || !signature) {
      throw new BadRequestException("Missing Stripe webhook signature or body");
    }
    try {
      return this.stripeService.constructWebhookEvent(rawBody, signature);
    } catch {
      throw new BadRequestException("Invalid Stripe webhook signature");
    }
  }

  async processWebhook(event: Stripe.Event) {
    this.stripeService.assertEventMode(event);
    const existing = await this.prisma.stripeWebhookEvent.findUnique({
      where: { id: event.id },
    });
    if (existing?.processedAt) return { received: true, duplicate: true };

    await this.prisma.stripeWebhookEvent.upsert({
      where: { id: event.id },
      update: {},
      create: {
        id: event.id,
        type: event.type,
        payload: event as unknown as Prisma.InputJsonValue,
      },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "StripeWebhookEvent" WHERE id = ${event.id} FOR UPDATE`;
      const inTransaction = await tx.stripeWebhookEvent.findUnique({
        where: { id: event.id },
      });
      if (inTransaction?.processedAt) return;

      await tx.stripeWebhookEvent.update({
        where: { id: event.id },
        data: { unresolved: false },
      });
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          await this.handleCheckoutSession(
            tx,
            session,
            session.payment_status === "paid" ? "paid" : null,
          );
          break;
        }
        case "checkout.session.async_payment_succeeded":
          await this.handleCheckoutSession(
            tx,
            event.data.object as Stripe.Checkout.Session,
            "paid",
          );
          break;
        case "checkout.session.expired":
          await this.handleCheckoutSession(
            tx,
            event.data.object as Stripe.Checkout.Session,
            "expired",
          );
          break;
        case "checkout.session.async_payment_failed":
          await this.handleCheckoutSession(
            tx,
            event.data.object as Stripe.Checkout.Session,
            "failed",
          );
          break;
        case "payment_intent.payment_failed":
          await this.handleFailedPaymentIntent(
            tx,
            event.data.object as Stripe.PaymentIntent,
          );
          break;
        case "payment_intent.succeeded":
          await this.handleSucceededPaymentIntent(
            tx,
            event.data.object as Stripe.PaymentIntent,
          );
          break;
        case "charge.refunded":
          await this.handleRefundedCharge(
            tx,
            event.data.object as Stripe.Charge,
            event,
          );
          break;
        case "charge.dispute.updated":
        case "charge.dispute.created":
          await this.handleDisputeCreated(
            tx,
            event.data.object as Stripe.Dispute,
            event,
          );
          break;
        case "charge.dispute.closed":
          await this.handleDisputeClosed(
            tx,
            event.data.object as Stripe.Dispute,
            event,
          );
          break;
        default:
          break;
      }

      const recorded = await tx.stripeWebhookEvent.findUniqueOrThrow({
        where: { id: event.id },
      });
      if (recorded.unresolved)
        await tx.stripeWebhookEvent.update({
          where: { id: event.id },
          data: { nextRunAt: new Date(Date.now() + 60_000) },
        });
      if (!recorded.unresolved)
        await tx.stripeWebhookEvent.update({
          where: { id: event.id },
          data: { processedAt: new Date() },
        });
    });
    return { received: true, duplicate: false };
  }

  private validateAmount(
    payment: { grossAmount: number; currency: string },
    amount: number | null,
    currency: string | null,
  ) {
    if (amount !== payment.grossAmount || currency !== payment.currency) {
      throw new BadRequestException("Stripe payment amount mismatch");
    }
  }

  private async handleCheckoutSession(
    tx: Prisma.TransactionClient,
    session: Stripe.Checkout.Session,
    status: "paid" | "failed" | "expired" | null,
  ) {
    const match = await this.attempts.match(
      tx,
      session.metadata,
      session.id,
      objectId(session.payment_intent),
    );
    if (!match) return;
    this.validateAmount(match.attempt, session.amount_total, session.currency);
    const payment = await this.attempts.apply(tx, match, status ?? "complete", {
      sessionId: session.id,
      intentId: objectId(session.payment_intent),
    });
    if (payment && status)
      await this.setPaymentStatus(
        tx,
        payment,
        status === "expired" ? "failed" : status,
      );
  }

  private async handleSucceededPaymentIntent(
    tx: Prisma.TransactionClient,
    intent: Stripe.PaymentIntent,
  ) {
    const match = await this.attempts.match(
      tx,
      intent.metadata,
      undefined,
      intent.id,
    );
    if (!match) return;
    this.validateAmount(match.attempt, intent.amount, intent.currency);
    const payment = await this.attempts.apply(tx, match, "paid", {
      intentId: intent.id,
      chargeId: objectId(intent.latest_charge),
    });
    if (payment) await this.setPaymentStatus(tx, payment, "paid");
  }

  private async handleFailedPaymentIntent(
    tx: Prisma.TransactionClient,
    intent: Stripe.PaymentIntent,
  ) {
    const match = await this.attempts.match(
      tx,
      intent.metadata,
      undefined,
      intent.id,
    );
    if (!match) return;
    this.validateAmount(match.attempt, intent.amount, intent.currency);
    const payment = await this.attempts.apply(tx, match, "failed", {
      intentId: intent.id,
    });
    if (payment) await this.setPaymentStatus(tx, payment, "failed");
  }

  private async financialPayment(
    tx: Prisma.TransactionClient,
    intentId?: string,
    chargeId?: string,
  ) {
    const attempt = await tx.paymentAttempt.findFirst({
      where: {
        OR: [
          ...(intentId ? [{ stripePaymentIntentId: intentId }] : []),
          ...(chargeId ? [{ stripeChargeId: chargeId }] : []),
        ],
      },
    });
    const payment = attempt
      ? await tx.payment.findUnique({
          where: { id: attempt.paymentId },
          include: { provider: { select: { userId: true } } },
        })
      : await tx.payment.findFirst({
          where: {
            OR: [
              ...(intentId ? [{ stripePaymentIntentId: intentId }] : []),
              ...(chargeId ? [{ stripeChargeId: chargeId }] : []),
            ],
          },
          include: { provider: { select: { userId: true } } },
        });
    if (!payment) return { payment, attempt };
    await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${payment.id} FOR UPDATE`;
    const fresh = await tx.payment.findUniqueOrThrow({
      where: { id: payment.id },
      include: { provider: { select: { userId: true } } },
    });
    return { payment: fresh, attempt };
  }

  private async handleRefundedCharge(
    tx: Prisma.TransactionClient,
    charge: Stripe.Charge,
    event: Stripe.Event,
  ) {
    const { payment, attempt } = await this.financialPayment(
      tx,
      objectId(charge.payment_intent),
      charge.id,
    );
    if (!payment) {
      await tx.stripeWebhookEvent.update({
        where: { id: event.id },
        data: { unresolved: true },
      });
      return;
    }
    this.validateAmount(payment, charge.amount, charge.currency);
    const isPaidOrActiveAttempt = !attempt
      ? !payment.activeAttemptId
      : payment.paidAttemptId
        ? payment.paidAttemptId === attempt.id
        : payment.activeAttemptId === attempt.id;
    // Partial refunds retain existing policy: flag for operations; do not invent a proportional payout.
    if (charge.amount_refunded !== charge.amount) {
      await tx.payment.update({
        where: { id: payment.id },
        data: { reconciliationReason: "partial_refund_requires_review" },
      });
    } else {
      if (attempt)
        await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: { refundedAt: new Date() },
        });
      if (isPaidOrActiveAttempt) {
        await this.setPaymentStatus(tx, payment, "refunded");
      } else
        await tx.payment.update({
          where: { id: payment.id },
          data: { reconciliationReason: "stale_collection_refunded" },
        });
    }
    // Only the attempt that was actually paid/transferred can owe a reversal;
    // a refund on a stale/duplicate collection must not reverse someone else's transfer.
    if (
      isPaidOrActiveAttempt &&
      payment.stripeTransferId &&
      !payment.transferReversedAt
    )
      await this.operations.enqueueReversal(
        tx,
        payment.id,
        payment.stripeTransferId,
        "refund",
      );
  }

  private async applyDispute(
    tx: Prisma.TransactionClient,
    dispute: Stripe.Dispute,
    event: Stripe.Event,
    closed: boolean,
  ) {
    const { payment } = await this.financialPayment(
      tx,
      objectId(dispute.payment_intent),
      objectId(dispute.charge),
    );
    if (!payment) {
      await tx.stripeWebhookEvent.update({
        where: { id: event.id },
        data: { unresolved: true },
      });
      return;
    }
    const existing = await tx.paymentDispute.findUnique({
      where: { id: dispute.id },
    });
    if (
      existing &&
      (existing.closed || existing.eventCreated > (event.created ?? 0))
    )
      return;
    await tx.paymentDispute.upsert({
      where: { id: dispute.id },
      update: {
        status: dispute.status,
        closed,
        eventCreated: event.created ?? 0,
      },
      create: {
        id: dispute.id,
        paymentId: payment.id,
        stripeChargeId: objectId(dispute.charge),
        stripePaymentIntentId: objectId(dispute.payment_intent),
        status: dispute.status,
        closed,
        eventCreated: event.created ?? 0,
      },
    });
    const blocking = await tx.paymentDispute.count({
      where: { paymentId: payment.id, status: { not: "won" } },
    });
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        disputedAt: blocking ? (payment.disputedAt ?? new Date()) : null,
      },
    });
    if (blocking && payment.stripeTransferId && !payment.transferReversedAt)
      await this.operations.enqueueReversal(
        tx,
        payment.id,
        payment.stripeTransferId,
        "dispute",
      );
  }

  private handleDisputeCreated(
    tx: Prisma.TransactionClient,
    dispute: Stripe.Dispute,
    event: Stripe.Event,
  ) {
    return this.applyDispute(tx, dispute, event, false);
  }

  private handleDisputeClosed(
    tx: Prisma.TransactionClient,
    dispute: Stripe.Dispute,
    event: Stripe.Event,
  ) {
    return this.applyDispute(tx, dispute, event, true);
  }

  async requestRefund(
    user: { id: string; userType?: string },
    bookingId: string,
  ) {
    const op = await this.operations.requestRefund(user, bookingId);
    await this.operations.runOperation(op.id);
    const fresh = await this.prisma.paymentOperation.findUniqueOrThrow({
      where: { id: op.id },
    });
    return {
      refundId: fresh.externalId,
      status: fresh.status,
      operationId: fresh.id,
    };
  }

  async requestCompletion(userId: string, bookingId: string) {
    const op = await this.operations.requestCompletion(userId, bookingId);
    return { operationId: op.id, status: op.status };
  }

  async reconcilePendingWebhooks() {
    const pending = await this.prisma.stripeWebhookEvent.findMany({
      where: {
        processedAt: null,
        reconciliationReason: null,
        nextRunAt: { lte: new Date() },
        payload: { not: Prisma.DbNull },
      },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
    for (const row of pending) {
      try {
        await this.processWebhook(row.payload as unknown as Stripe.Event);
      } catch (error) {
        // Schedule outside the rolled-back handler transaction so poison events cannot monopolize every batch.
        await this.prisma.stripeWebhookEvent.updateMany({
          where: { id: row.id, processedAt: null },
          data: {
            nextRunAt: new Date(Date.now() + 60_000),
            reconciliationReason:
              error instanceof BadRequestException
                ? "invalid_financial_event"
                : undefined,
          },
        });
      }
    }
  }

  isEnabled() {
    return this.stripeService.getPaymentsMode() !== "disabled";
  }

  async getBookingPaymentState(paymentId: string) {
    let lookupUnavailable = false;
    try {
      if (this.isEnabled()) await this.attempts.reconcileCheckout(paymentId);
    } catch {
      lookupUnavailable = true;
    }
    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: {
        operations: true,
        disputes: { select: { id: true, status: true } },
      },
    });
    const attempt = payment.activeAttemptId
      ? await this.prisma.paymentAttempt.findUnique({
          where: { id: payment.activeAttemptId },
        })
      : null;
    const checkoutState = payment.reconciliationReason
      ? "reconciliation_required"
      : ["paid", "refunded"].includes(payment.status)
        ? payment.status
        : lookupUnavailable && attempt && !attempt.paidAt
          ? "confirmation_processing"
          : !attempt
            ? "not_started"
            : attempt.status === "expired"
              ? attempt.failureConfirmed
                ? "failed"
                : "expired"
              : attempt.status === "open"
                ? "open"
                : "confirmation_processing";
    const completion = payment.operations.find(
      (op) => op.kind === "completion",
    );
    return {
      checkoutState,
      canRetry: ["expired", "failed", "not_started"].includes(checkoutState),
      reconciliationReason: payment.reconciliationReason,
      disputes: payment.disputes,
      operations: payment.operations.map((op) => ({
        id: op.id,
        kind: op.kind,
        status: op.status,
        errorCode: op.errorCode,
      })),
      disputed: !!payment.disputedAt,
      refundPending:
        !!payment.refundRequestedAt && payment.status !== "refunded",
      completionOperation: completion
        ? {
            id: completion.id,
            status: completion.status,
            errorCode: completion.errorCode,
          }
        : null,
    };
  }

  private async setPaymentStatus(
    tx: Prisma.TransactionClient,
    payment: {
      id: string;
      bookingId: string;
      customerId: string;
      status: PaymentStatus;
      provider: { userId: string };
    },
    status: "paid" | "failed" | "refunded",
  ) {
    if (payment.status === status) return;
    if (payment.status === "refunded") return;
    if (payment.status === "paid" && status === "failed") return;

    const timestamp = new Date();
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status,
        paidAt: status === "paid" ? timestamp : undefined,
        failedAt: status === "failed" ? timestamp : undefined,
        refundedAt: status === "refunded" ? timestamp : undefined,
      },
    });
    await tx.booking.update({
      where: { id: payment.bookingId },
      data: { paymentStatus: status },
    });

    if (status === "paid" && payment.status !== "paid") {
      await tx.notification.createMany({
        data: [
          {
            userId: payment.customerId,
            type: "payment_succeeded",
            title: "Payment received",
            message: "Your booking payment was completed successfully.",
            metadata: { bookingId: payment.bookingId, paymentId: payment.id },
          },
          {
            userId: payment.provider.userId,
            type: "payment_received",
            title: "Payment received",
            message: "A customer payment for your booking was completed.",
            metadata: { bookingId: payment.bookingId, paymentId: payment.id },
          },
        ],
      });
    }
  }
}
