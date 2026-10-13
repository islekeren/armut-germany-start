import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PaymentAttempt, Prisma } from "@prisma/client";
import Stripe from "stripe";
import { PrismaService } from "../../common/prisma/prisma.service";
import { PaymentCoordinationService } from "./payment-coordination.service";
import { StripeService } from "./stripe.service";

const DAY = 24 * 60 * 60 * 1000;
const objectId = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : value?.id;
export { objectId };

@Injectable()
export class PaymentAttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coordination: PaymentCoordinationService,
    private readonly stripe: StripeService,
  ) {}

  async createCheckout(
    paymentId: string,
    payload: Stripe.Checkout.SessionCreateParams,
  ) {
    await this.reconcileCheckout(paymentId);
    const attempt = await this.coordination.withPayment(
      paymentId,
      async (tx) => {
        const payment = await tx.payment.findUniqueOrThrow({
          where: { id: paymentId },
        });
        if (
          ["paid", "refunded"].includes(payment.status) ||
          payment.reconciliationReason
        ) {
          throw new ConflictException(
            "Booking payment is finalized or requires reconciliation",
          );
        }
        const current = payment.activeAttemptId
          ? await tx.paymentAttempt.findUnique({
              where: { id: payment.activeAttemptId },
            })
          : null;
        // A failed intent does not prove that its Checkout is no longer payable.
        if (current && !["expired"].includes(current.status)) return current;
        const id = randomUUID();
        const sequence = current ? current.sequence + 1 : 0;
        const metadata = { ...payload.metadata, attemptId: id };
        const snapshot = {
          ...payload,
          metadata,
          payment_intent_data: { ...payload.payment_intent_data, metadata },
        };
        const created = await tx.paymentAttempt.create({
          data: {
            id,
            paymentId,
            sequence,
            grossAmount: payment.grossAmount,
            currency: payment.currency,
            payload: JSON.parse(
              JSON.stringify(snapshot),
            ) as Prisma.InputJsonValue,
          },
        });
        await tx.payment.update({
          where: { id: paymentId },
          data: {
            activeAttemptId: id,
            checkoutAttempt: sequence,
            status: "pending",
            failedAt: null,
            stripeCheckoutSessionId: null,
            stripePaymentIntentId: null,
            stripeChargeId: null,
          },
        });
        await tx.booking.update({
          where: { id: payment.bookingId },
          data: { paymentStatus: "pending" },
        });
        return created;
      },
    );
    if (
      attempt.status === "complete" ||
      attempt.paidAt ||
      attempt.status === "reconciliation_required"
    ) {
      return {
        paymentId,
        attemptId: attempt.id,
        checkoutUrl: null,
        state: "confirmation_processing",
        reused: true,
      };
    }
    if (attempt.stripeCheckoutSessionId && attempt.checkoutUrl) {
      return {
        paymentId,
        attemptId: attempt.id,
        checkoutUrl: attempt.checkoutUrl,
        state: "open",
        reused: true,
      };
    }
    return this.createReserved(attempt.id);
  }

  async createReserved(attemptId: string) {
    const token = randomUUID();
    const claim = await this.prisma.paymentAttempt.updateMany({
      where: {
        id: attemptId,
        status: "creating",
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
      },
      data: { leaseToken: token, leaseUntil: new Date(Date.now() + 120_000) },
    });
    const attempt = await this.prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: attemptId },
    });
    if (!claim.count)
      return {
        paymentId: attempt.paymentId,
        attemptId,
        checkoutUrl: attempt.status === "open" ? attempt.checkoutUrl : null,
        state: attempt.paidAt
          ? "paid"
          : attempt.status === "open"
            ? "open"
            : attempt.status === "reconciliation_required"
              ? "reconciliation_required"
              : "confirmation_processing",
        reused: true,
      };
    if (
      !attempt.payload ||
      (attempt.firstCalledAt &&
        Date.now() - attempt.firstCalledAt.getTime() >= DAY)
    ) {
      await this.hold(attempt, "checkout_creation_uncertain");
      return {
        paymentId: attempt.paymentId,
        attemptId,
        checkoutUrl: null,
        state: "reconciliation_required",
        reused: true,
      };
    }
    await this.prisma.paymentAttempt.update({
      where: { id: attemptId },
      data: { firstCalledAt: attempt.firstCalledAt ?? new Date() },
    });
    try {
      const session = await this.stripe.createCheckoutSession(
        attempt.payload as unknown as Stripe.Checkout.SessionCreateParams,
        `checkout-session:${attempt.id}`,
      );
      const result = await this.coordination.withPayment(
        attempt.paymentId,
        async (tx) => {
          const fresh = await tx.paymentAttempt.findUniqueOrThrow({
            where: { id: attemptId },
          });
          if (
            (fresh.stripeCheckoutSessionId &&
              fresh.stripeCheckoutSessionId !== session.id) ||
            (fresh.stripePaymentIntentId &&
              objectId(session.payment_intent) &&
              fresh.stripePaymentIntentId !== objectId(session.payment_intent))
          ) {
            throw new BadRequestException("Stripe attempt object mismatch");
          }
          const payment = await tx.payment.findUniqueOrThrow({
            where: { id: attempt.paymentId },
          });
          let status = fresh.paidAt
            ? "paid"
            : session.status === "complete"
              ? fresh.failureConfirmed
                ? "expired"
                : "complete"
              : session.status === "expired"
                ? "expired"
                : ["complete", "expired", "reconciliation_required"].includes(
                      fresh.status,
                    )
                  ? fresh.status
                  : "open";
          if (status === "open" && !session.url) {
            status = "reconciliation_required";
            await tx.payment.update({
              where: { id: attempt.paymentId },
              data: { reconciliationReason: "checkout_not_redirectable" },
            });
          }
          await tx.paymentAttempt.update({
            where: { id: attemptId },
            data: {
              stripeCheckoutSessionId: session.id,
              stripePaymentIntentId: objectId(session.payment_intent),
              checkoutUrl: status === "open" ? session.url : null,
              expiresAt: session.expires_at
                ? new Date(session.expires_at * 1000)
                : undefined,
              status,
              leaseUntil: null,
              leaseToken: null,
            },
          });
          await tx.payment.updateMany({
            where: {
              id: attempt.paymentId,
              activeAttemptId: attempt.id,
              OR: [{ paidAttemptId: null }, { paidAttemptId: attempt.id }],
            },
            data: {
              stripeCheckoutSessionId: session.id,
              stripePaymentIntentId: objectId(session.payment_intent),
            },
          });
          const state =
            payment.reconciliationReason || status === "reconciliation_required"
              ? "reconciliation_required"
              : payment.status === "refunded"
                ? "refunded"
                : status === "paid"
                  ? "paid"
                  : status === "complete"
                    ? "confirmation_processing"
                    : status;
          return {
            paymentId: attempt.paymentId,
            attemptId,
            checkoutUrl: state === "open" ? session.url : null,
            state,
            reused: false,
          };
        },
      );
      return result;
    } catch (error) {
      // An ambiguous call never permits a successor; recovery uses the same payload and key.
      await this.prisma.paymentAttempt.updateMany({
        where: { id: attemptId, leaseToken: token },
        data: { leaseUntil: new Date(Date.now() + 5000) },
      });
      throw error;
    }
  }

  private async hold(attempt: PaymentAttempt, reason: string) {
    await this.coordination.withPayment(attempt.paymentId, async (tx) => {
      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: { status: "reconciliation_required", leaseUntil: null },
      });
      await tx.payment.update({
        where: { id: attempt.paymentId },
        data: { reconciliationReason: reason },
      });
    });
  }

  async reconcileCheckout(paymentId: string) {
    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
    });
    if (
      !payment.activeAttemptId ||
      payment.status === "paid" ||
      payment.status === "refunded"
    )
      return;
    const attempt = await this.prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: payment.activeAttemptId },
    });
    if (
      !attempt.stripeCheckoutSessionId ||
      attempt.status === "expired" ||
      attempt.paidAt
    )
      return;
    const session = await this.stripe.retrieveCheckoutSession(
      attempt.stripeCheckoutSessionId,
    );
    await this.coordination.withPayment(paymentId, async (tx) => {
      const fresh = await tx.paymentAttempt.findUniqueOrThrow({
        where: { id: attempt.id },
      });
      if (fresh.paidAt) return;
      // A completed session stays processing until an authoritative financial event.
      const status =
        session.status === "complete"
          ? fresh.failureConfirmed
            ? "expired"
            : "complete"
          : session.status === "expired"
            ? "expired"
            : "open";
      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: { status, checkoutUrl: session.url },
      });
    });
  }

  async match(
    tx: Prisma.TransactionClient,
    metadata: Stripe.Metadata | null,
    sessionId?: string,
    intentId?: string,
  ) {
    let attempt = metadata?.attemptId
      ? await tx.paymentAttempt.findUnique({
          where: { id: metadata.attemptId },
        })
      : await tx.paymentAttempt.findFirst({
          where: {
            OR: [
              ...(sessionId ? [{ stripeCheckoutSessionId: sessionId }] : []),
              ...(intentId ? [{ stripePaymentIntentId: intentId }] : []),
            ],
          },
        });
    if (!attempt) {
      if (metadata?.paymentId)
        throw new ConflictException(
          "Stripe payment attempt is not yet associated",
        );
      return null;
    }
    await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${attempt.paymentId} FOR UPDATE`;
    attempt = await tx.paymentAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
    });
    const payment = await tx.payment.findUniqueOrThrow({
      where: { id: attempt.paymentId },
      include: { provider: { select: { userId: true } } },
    });
    if (
      metadata?.paymentId &&
      (metadata.paymentId !== payment.id ||
        metadata.bookingId !== payment.bookingId ||
        metadata.providerId !== payment.providerId ||
        metadata.customerId !== payment.customerId)
    ) {
      throw new BadRequestException("Stripe payment metadata mismatch");
    }
    if (
      (sessionId &&
        attempt.stripeCheckoutSessionId &&
        attempt.stripeCheckoutSessionId !== sessionId) ||
      (intentId &&
        attempt.stripePaymentIntentId &&
        attempt.stripePaymentIntentId !== intentId)
    )
      throw new BadRequestException("Stripe attempt object mismatch");
    return { attempt, payment };
  }

  async apply(
    tx: Prisma.TransactionClient,
    match: NonNullable<Awaited<ReturnType<PaymentAttemptsService["match"]>>>,
    outcome: "paid" | "failed" | "expired" | "complete",
    ids: { sessionId?: string; intentId?: string; chargeId?: string },
  ) {
    const { attempt, payment } = match;
    await tx.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        stripeCheckoutSessionId: ids.sessionId,
        stripePaymentIntentId: ids.intentId,
        stripeChargeId: ids.chargeId,
        status: attempt.paidAt ? "paid" : outcome,
        paidAt: outcome === "paid" ? (attempt.paidAt ?? new Date()) : undefined,
        failedAt: outcome === "failed" ? new Date() : undefined,
        failureConfirmed:
          outcome === "failed" && !!ids.sessionId ? true : undefined,
      },
    });
    if (outcome === "paid") {
      if (
        (payment.paidAttemptId && payment.paidAttemptId !== attempt.id) ||
        payment.activeAttemptId !== attempt.id
      ) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { reconciliationReason: "stale_or_duplicate_collection" },
        });
        return null;
      }
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          paidAttemptId: attempt.id,
          stripeCheckoutSessionId: ids.sessionId,
          stripePaymentIntentId: ids.intentId,
          stripeChargeId: ids.chargeId,
        },
      });
      return payment;
    }
    if (
      payment.activeAttemptId !== attempt.id ||
      attempt.paidAt ||
      payment.status === "paid" ||
      payment.status === "refunded"
    )
      return null;
    // Session failure can leave Checkout payable: refresh/expire it before replacement.
    return outcome === "failed" || outcome === "expired" ? payment : null;
  }
}
