import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PaymentStatus, Prisma } from "@prisma/client";
import Stripe from "stripe";
import { PrismaService } from "../../common/prisma/prisma.service";
import { StripeService } from "./stripe.service";

const MINIMUM_EUR_AMOUNT = 50;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

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
    if (
      !booking.provider.stripeAccountId ||
      booking.provider.stripeOnboardingStatus !== "ready" ||
      !booking.provider.stripeTransfersEnabled
    ) {
      throw new BadRequestException(
        "Provider is not ready to receive Stripe payments",
      );
    }
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
          application_fee_amount: payment.platformFeeAmount,
          transfer_data: {
            destination: booking.provider.stripeAccountId,
          },
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
        case "charge.refunded":
          await this.handleRefundedCharge(
            tx,
            event.data.object as Stripe.Charge,
          );
          break;
        default:
          break;
      }

      await tx.stripeWebhookEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date() },
      });
    });

    return { received: true, duplicate: false };
  }

  private async paymentFromMetadata(
    tx: Prisma.TransactionClient,
    metadata: Stripe.Metadata | null,
  ) {
    const paymentId = metadata?.paymentId;
    if (!paymentId) throw new BadRequestException("Missing payment metadata");

    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { provider: { select: { userId: true } } },
    });
    if (!payment) throw new NotFoundException("Payment not found");
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
    if (!payment) throw new NotFoundException("Payment not found");
    this.validateAmount(payment, paymentIntent.amount, paymentIntent.currency);
    await this.setPaymentStatus(tx, payment, "failed");
  }

  private async handleRefundedCharge(
    tx: Prisma.TransactionClient,
    charge: Stripe.Charge,
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
    if (!payment) throw new NotFoundException("Payment not found");
    this.validateAmount(payment, charge.amount, charge.currency);
    await this.setPaymentStatus(tx, payment, "refunded");
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
