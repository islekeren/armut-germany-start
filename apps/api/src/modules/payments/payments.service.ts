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

const MINIMUM_EUR_AMOUNT = 50;

interface ReversiblePayment {
  id: string;
  bookingId: string;
  stripeTransferId: string | null;
  stripeTransferReversalId: string | null;
  transferReversedAt: Date | null;
}

interface PendingReversal {
  payment: ReversiblePayment;
  reason: "refund" | "dispute";
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly stripeConnectService: StripeConnectService,
  ) {}

  private isProviderReady(provider: {
    stripeAccountId: string | null;
    stripeOnboardingStatus: string;
    stripeTransfersEnabled: boolean;
    stripePayoutsEnabled: boolean;
  }) {
    return (
      !!provider.stripeAccountId &&
      provider.stripeOnboardingStatus === "ready" &&
      provider.stripeTransfersEnabled &&
      provider.stripePayoutsEnabled
    );
  }

  /**
   * Cheap check on the stored flags first, then a live read from Stripe:
   * onboarding state is only refreshed when a provider opens their finances
   * page, so the stored flags alone can be stale.
   */
  private async ensureProviderReady(
    provider: {
      id: string;
      stripeAccountId: string | null;
      stripeOnboardingStatus: string;
      stripeTransfersEnabled: boolean;
      stripePayoutsEnabled: boolean;
      stripeOnboardedAt: Date | null;
    },
    message: string,
  ) {
    if (!this.isProviderReady(provider)) throw new BadRequestException(message);

    const fresh = await this.stripeConnectService.syncProvider({
      id: provider.id,
      stripeAccountId: provider.stripeAccountId!,
      stripeOnboardedAt: provider.stripeOnboardedAt,
    });
    if (!this.isProviderReady(fresh)) throw new BadRequestException(message);
  }

  calculateAmounts(totalPrice: number) {
    const grossAmount = Math.round(totalPrice * 100);
    if (!Number.isSafeInteger(grossAmount) || grossAmount < MINIMUM_EUR_AMOUNT) {
      throw new BadRequestException(
        "Booking amount must be at least EUR 0.50",
      );
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
    await this.ensureProviderReady(
      booking.provider,
      "Provider is not ready to receive Stripe payments",
    );
    if (["paid", "refunded"].includes(booking.paymentStatus)) {
      throw new ConflictException("Booking payment is already finalized");
    }

    const amounts = this.calculateAmounts(booking.totalPrice);
    let payment = await this.prisma.payment.upsert({
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

    if (payment.stripeCheckoutSessionId) {
      const existingSession = await this.stripeService.retrieveCheckoutSession(
        payment.stripeCheckoutSessionId,
      );

      if (existingSession.status === "open" && payment.status !== "failed") {
        if (!existingSession.url) {
          throw new ConflictException("Existing checkout is not redirectable");
        }
        return {
          checkoutUrl: existingSession.url,
          paymentId: payment.id,
          reused: true,
        };
      }

      if (
        existingSession.status === "complete" &&
        payment.status !== "failed"
      ) {
        throw new ConflictException(
          "Checkout is complete and payment confirmation is processing",
        );
      }

      if (existingSession.status === "open") {
        await this.stripeService.expireCheckoutSession(existingSession.id);
      }

      payment = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          stripeCheckoutSessionId: null,
          stripePaymentIntentId: null,
          stripeChargeId: null,
          checkoutAttempt: { increment: 1 },
          status: "pending",
          failedAt: null,
        },
      });
    } else if (payment.status === "failed") {
      payment = await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: "pending", failedAt: null },
      });
    }

    const metadata = {
      bookingId: booking.id,
      paymentId: payment.id,
      providerId: booking.providerId,
      customerId: booking.customerId,
    };
    const urls = this.stripeService.getCheckoutUrls(booking.id);
    const session = await this.stripeService.createCheckoutSession(
      {
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
      },
      `checkout-session:${payment.id}:${payment.checkoutAttempt}`,
    );

    if (!session.url) {
      throw new BadRequestException("Stripe did not return a checkout URL");
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id,
      },
    });

    return { checkoutUrl: session.url, paymentId: payment.id, reused: false };
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
    const existing = await this.prisma.stripeWebhookEvent.findUnique({
      where: { id: event.id },
    });
    if (existing?.processedAt) return { received: true, duplicate: true };

    // Transfer reversals call Stripe, so they run after the database
    // transaction commits instead of holding it open. If one fails the event
    // stays unprocessed and Stripe redelivers it; the status updates above are
    // idempotent and the reversal has a stable idempotency key.
    const reversals: PendingReversal[] = [];

    await this.prisma.$transaction(async (tx) => {
      const inTransaction = await tx.stripeWebhookEvent.findUnique({
        where: { id: event.id },
      });
      if (inTransaction?.processedAt) return;

      if (!inTransaction) {
        await tx.stripeWebhookEvent.create({
          data: { id: event.id, type: event.type },
        });
      }

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
            reversals,
          );
          break;
        case "charge.dispute.created":
          await this.handleDisputeCreated(
            tx,
            event.data.object as Stripe.Dispute,
            reversals,
          );
          break;
        case "charge.dispute.closed":
          await this.handleDisputeClosed(
            tx,
            event.data.object as Stripe.Dispute,
          );
          break;
        default:
          break;
      }

      if (!reversals.length) {
        await tx.stripeWebhookEvent.update({
          where: { id: event.id },
          data: { processedAt: new Date() },
        });
      }
    });

    if (reversals.length) {
      for (const reversal of reversals) {
        await this.reverseProviderTransfer(reversal.payment, reversal.reason);
      }
      await this.prisma.stripeWebhookEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date() },
      });
    }

    return { received: true, duplicate: false };
  }

  private async paymentFromMetadata(
    tx: Prisma.TransactionClient,
    metadata: Stripe.Metadata | null,
  ) {
    // Events for objects this platform did not create (no paymentId metadata,
    // or an id we do not know) are acknowledged and ignored. Throwing would
    // make Stripe retry them indefinitely.
    const paymentId = metadata?.paymentId;
    if (!paymentId) return null;

    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { provider: { select: { userId: true } } },
    });
    if (!payment) {
      this.logger.warn(`Ignoring Stripe event for unknown payment ${paymentId}`);
      return null;
    }
    if (
      metadata.bookingId !== payment.bookingId ||
      metadata.providerId !== payment.providerId ||
      metadata.customerId !== payment.customerId
    ) {
      throw new BadRequestException("Stripe payment metadata mismatch");
    }
    return payment;
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
    status: "paid" | "failed" | null,
  ) {
    const payment = await this.paymentFromMetadata(tx, session.metadata);
    if (!payment) return;
    this.validateAmount(payment, session.amount_total, session.currency);

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
      },
    });

    if (status) await this.setPaymentStatus(tx, payment, status);
  }

  private async handleSucceededPaymentIntent(
    tx: Prisma.TransactionClient,
    paymentIntent: Stripe.PaymentIntent,
  ) {
    const payment = await this.paymentFromMetadata(tx, paymentIntent.metadata);
    if (!payment) return;
    this.validateAmount(payment, paymentIntent.amount, paymentIntent.currency);

    const chargeId =
      typeof paymentIntent.latest_charge === "string"
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge?.id;

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        stripePaymentIntentId: paymentIntent.id,
        stripeChargeId: chargeId,
      },
    });
    await this.setPaymentStatus(tx, payment, "paid");
  }

  private async handleFailedPaymentIntent(
    tx: Prisma.TransactionClient,
    paymentIntent: Stripe.PaymentIntent,
  ) {
    let payment = paymentIntent.metadata?.paymentId
      ? await this.paymentFromMetadata(tx, paymentIntent.metadata)
      : null;
    if (!payment) {
      payment = await tx.payment.findUnique({
        where: { stripePaymentIntentId: paymentIntent.id },
        include: { provider: { select: { userId: true } } },
      });
    }
    if (!payment) return;
    this.validateAmount(payment, paymentIntent.amount, paymentIntent.currency);
    await this.setPaymentStatus(tx, payment, "failed");
  }

  private async handleRefundedCharge(
    tx: Prisma.TransactionClient,
    charge: Stripe.Charge,
    reversals: PendingReversal[],
  ) {
    if (charge.amount_refunded !== charge.amount) return;
    const paymentIntentId =
      typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent?.id;
    if (!paymentIntentId) return;

    const payment = await tx.payment.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
      include: { provider: { select: { userId: true } } },
    });
    if (!payment) return;
    this.validateAmount(payment, charge.amount, charge.currency);
    reversals.push({ payment, reason: "refund" });
    await tx.payment.update({
      where: { id: payment.id },
      data: { stripeChargeId: charge.id },
    });
    await this.setPaymentStatus(tx, payment, "refunded");
  }

  private async findPaymentForDispute(
    tx: Prisma.TransactionClient,
    dispute: Stripe.Dispute,
  ) {
    const chargeId =
      typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
    const paymentIntentId =
      typeof dispute.payment_intent === "string"
        ? dispute.payment_intent
        : dispute.payment_intent?.id;
    const lookups: Prisma.PaymentWhereInput[] = [];
    if (chargeId) lookups.push({ stripeChargeId: chargeId });
    if (paymentIntentId) lookups.push({ stripePaymentIntentId: paymentIntentId });
    if (!lookups.length) return null;

    return tx.payment.findFirst({ where: { OR: lookups } });
  }

  private async handleDisputeCreated(
    tx: Prisma.TransactionClient,
    dispute: Stripe.Dispute,
    reversals: PendingReversal[],
  ) {
    const payment = await this.findPaymentForDispute(tx, dispute);
    if (!payment) return;

    // Hold the payout even when nothing was transferred yet, so a later
    // completion confirmation cannot release disputed funds.
    if (!payment.disputedAt) {
      await tx.payment.update({
        where: { id: payment.id },
        data: { disputedAt: new Date() },
      });
    }
    reversals.push({ payment, reason: "dispute" });
  }

  private async handleDisputeClosed(
    tx: Prisma.TransactionClient,
    dispute: Stripe.Dispute,
  ) {
    if (dispute.status !== "won") return;
    const payment = await this.findPaymentForDispute(tx, dispute);
    if (!payment?.disputedAt) return;

    await tx.payment.update({
      where: { id: payment.id },
      data: { disputedAt: null },
    });
  }

  private async reverseProviderTransfer(
    payment: ReversiblePayment,
    reason: "refund" | "dispute",
  ) {
    if (
      !payment.stripeTransferId ||
      payment.stripeTransferReversalId ||
      payment.transferReversedAt
    ) {
      return;
    }

    const reversal = await this.stripeService.reverseTransfer(
      payment.stripeTransferId,
      {
        metadata: {
          paymentId: payment.id,
          bookingId: payment.bookingId,
          reason,
        },
      },
      `provider-transfer-reversal:${payment.id}`,
    );
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        stripeTransferReversalId: reversal.id,
        transferReversedAt: new Date(),
      },
    });
  }

  async requestRefund(
    user: { id: string; userType?: string },
    bookingId: string,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { bookingId },
      include: { booking: { select: { status: true } } },
    });
    if (!payment) throw new NotFoundException("Payment not found");

    const isAdmin = user.userType === "admin";
    if (!isAdmin && payment.customerId !== user.id) {
      throw new ForbiddenException("Not authorized to refund this booking");
    }
    if (payment.status === "refunded") {
      throw new ConflictException("Booking payment is already refunded");
    }
    if (payment.status !== "paid") {
      throw new BadRequestException("Only paid bookings can be refunded");
    }
    if (
      !isAdmin &&
      (payment.stripeTransferId || payment.booking.status === "completed")
    ) {
      throw new ForbiddenException(
        "Released payments can only be refunded by an admin",
      );
    }
    if (!payment.stripePaymentIntentId) {
      throw new ConflictException("Stripe payment intent is missing");
    }

    // Payment and booking state flip to `refunded` (and any released transfer
    // is reversed) when the signed charge.refunded webhook arrives.
    const refund = await this.stripeService.createRefund(
      {
        payment_intent: payment.stripePaymentIntentId,
        metadata: {
          paymentId: payment.id,
          bookingId: payment.bookingId,
          requestedBy: user.id,
        },
      },
      `payment-refund:${payment.id}`,
    );

    return { refundId: refund.id, status: refund.status };
  }

  async releaseProviderFunds(bookingId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { bookingId },
      include: { provider: true },
    });
    if (!payment || payment.status !== "paid") {
      throw new BadRequestException(
        "Booking must have a confirmed payment before completion",
      );
    }
    if (payment.stripeTransferReversalId || payment.transferReversedAt) {
      throw new ConflictException("Provider transfer has already been reversed");
    }
    if (payment.disputedAt) {
      throw new ConflictException(
        "Provider transfer is on hold while the payment is disputed",
      );
    }
    if (payment.stripeTransferId && payment.transferredAt) return payment;
    await this.ensureProviderReady(
      payment.provider,
      "Provider is not ready to receive Stripe transfers",
    );
    if (!payment.stripePaymentIntentId) {
      throw new ConflictException("Stripe payment intent is missing");
    }

    let chargeId = payment.stripeChargeId;
    if (!chargeId) {
      const paymentIntent = await this.stripeService.retrievePaymentIntent(
        payment.stripePaymentIntentId,
      );
      chargeId =
        typeof paymentIntent.latest_charge === "string"
          ? paymentIntent.latest_charge
          : paymentIntent.latest_charge?.id ?? null;
    }
    if (!chargeId) {
      throw new ConflictException("Stripe source charge is not available");
    }

    const transfer = await this.stripeService.createTransfer(
      {
        amount: payment.providerAmount,
        currency: payment.currency,
        destination: payment.provider.stripeAccountId,
        source_transaction: chargeId,
        transfer_group: `booking:${bookingId}`,
        metadata: {
          bookingId,
          paymentId: payment.id,
          providerId: payment.providerId,
          customerId: payment.customerId,
        },
      },
      `provider-transfer:${payment.id}`,
    );

    return this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        stripeChargeId: chargeId,
        stripeTransferId: transfer.id,
        transferredAt: new Date(),
      },
    });
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
