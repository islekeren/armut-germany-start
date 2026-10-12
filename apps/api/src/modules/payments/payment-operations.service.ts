import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PaymentOperation, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { PrismaService } from "../../common/prisma/prisma.service";
import { PaymentCoordinationService } from "./payment-coordination.service";
import { StripeService } from "./stripe.service";
import { StripeConnectService } from "./stripe-connect.service";
import { objectId } from "./payment-attempts.service";

const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value));
const DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class PaymentOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coordination: PaymentCoordinationService,
    private readonly stripe: StripeService,
    private readonly connect: StripeConnectService,
  ) {}

  private blocked(payment: {
    status: string;
    disputedAt: Date | null;
    refundRequestedAt: Date | null;
    reconciliationReason: string | null;
  }) {
    return (
      payment.status !== "paid" ||
      !!payment.disputedAt ||
      !!payment.refundRequestedAt ||
      !!payment.reconciliationReason
    );
  }

  async requestTransfer(paymentId: string) {
    this.stripe.assertEnabled();
    const previous = await this.prisma.paymentOperation.findUnique({
      where: { paymentId_kind: { paymentId, kind: "transfer" } },
    });
    if (previous) return previous;
    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { provider: true },
    });
    if (this.blocked(payment) || payment.transferReversedAt)
      throw new ConflictException("Payment payout is on hold");
    const provider = await this.connect.ensureEligible(payment.providerId);
    let chargeId = payment.stripeChargeId;
    if (!chargeId && payment.stripePaymentIntentId)
      chargeId =
        objectId(
          (
            await this.stripe.retrievePaymentIntent(
              payment.stripePaymentIntentId,
            )
          ).latest_charge,
        ) ?? null;
    if (!chargeId)
      throw new ConflictException("Stripe source charge is not available");
    const payload: Stripe.TransferCreateParams = {
      amount: payment.providerAmount,
      currency: payment.currency,
      destination: provider.stripeAccountId!,
      source_transaction: chargeId,
      transfer_group: `booking:${payment.bookingId}`,
      metadata: {
        paymentId,
        bookingId: payment.bookingId,
        providerId: payment.providerId,
        customerId: payment.customerId,
      },
    };
    return this.coordination.withPayment(paymentId, async (tx) => {
      const fresh = await tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
      });
      if (this.blocked(fresh) || fresh.transferReversedAt)
        throw new ConflictException("Payment payout is on hold");
      return tx.paymentOperation.upsert({
        where: { paymentId_kind: { paymentId, kind: "transfer" } },
        update: {},
        create: {
          paymentId,
          kind: "transfer",
          payload: json(payload),
          idempotencyKey: `provider-transfer:${paymentId}`,
          // Preserve an existing legacy transfer instead of calling Stripe again.
          status: fresh.stripeTransferId ? "succeeded" : "pending",
          externalId: fresh.stripeTransferId,
        },
      });
    });
  }

  async requestRefund(
    user: { id: string; userType?: string },
    bookingId: string,
  ) {
    this.stripe.assertEnabled();
    const payment = await this.prisma.payment.findUnique({
      where: { bookingId },
    });
    if (!payment) throw new NotFoundException("Payment not found");
    return this.coordination.withPayment(payment.id, async (tx) => {
      const fresh = await tx.payment.findUniqueOrThrow({
        where: { id: payment.id },
        include: { booking: true, operations: true },
      });
      const admin = user.userType === "admin";
      if (!admin && fresh.customerId !== user.id)
        throw new ForbiddenException("Not authorized to refund this booking");
      if (
        !admin &&
        (fresh.stripeTransferId ||
          fresh.booking.status === "completed" ||
          fresh.operations.some(
            (op) =>
              op.kind === "transfer" &&
              !(op.status === "failed" && !op.firstCalledAt),
          ))
      ) {
        throw new ForbiddenException(
          "Released payments can only be refunded by an admin",
        );
      }
      const existing = fresh.operations.find((op) => op.kind === "refund");
      if (existing) return existing;
      if (fresh.status !== "paid" || !fresh.stripePaymentIntentId)
        throw new BadRequestException("Only paid bookings can be refunded");
      await tx.payment.update({
        where: { id: payment.id },
        data: { refundRequestedAt: new Date() },
      });
      return tx.paymentOperation.create({
        data: {
          paymentId: payment.id,
          kind: "refund",
          idempotencyKey: `payment-refund:${payment.id}`,
          payload: json({
            payment_intent: fresh.stripePaymentIntentId,
            metadata: {
              paymentId: payment.id,
              bookingId,
              requestedBy: user.id,
            },
          }),
        },
      });
    });
  }

  async enqueueReversal(
    tx: Prisma.TransactionClient,
    paymentId: string,
    transferId: string,
    reason: string,
  ) {
    return tx.paymentOperation.upsert({
      where: { paymentId_kind: { paymentId, kind: "reversal" } },
      update: {},
      create: {
        paymentId,
        kind: "reversal",
        payload: json({
          transferId,
          params: { metadata: { paymentId, reason } },
        }),
        idempotencyKey: `provider-transfer-reversal:${paymentId}`,
      },
    });
  }

  async requestCompletion(userId: string, bookingId: string) {
    this.stripe.assertEnabled();
    const payment = await this.prisma.payment.findUnique({
      where: { bookingId },
    });
    if (!payment)
      throw new BadRequestException(
        "Booking must have a confirmed payment before completion",
      );
    return this.coordination.withPayment(payment.id, async (tx) => {
      const fresh = await tx.payment.findUniqueOrThrow({
        where: { id: payment.id },
        include: { booking: true },
      });
      if (fresh.customerId !== userId)
        throw new ForbiddenException("Only customer can confirm completion");
      const existing = await tx.paymentOperation.findUnique({
        where: {
          paymentId_kind: { paymentId: payment.id, kind: "completion" },
        },
      });
      if (existing) return existing;
      if (fresh.booking.status !== "completion_pending")
        throw new BadRequestException(
          "Booking must be marked as completion pending before customer confirmation",
        );
      if (this.blocked(fresh) || fresh.transferReversedAt)
        throw new ConflictException("Payment payout is on hold");
      return tx.paymentOperation.create({
        data: {
          paymentId: payment.id,
          kind: "completion",
          payload: {},
          idempotencyKey: `completion:${payment.id}`,
        },
      });
    });
  }

  async runOperation(id: string): Promise<void> {
    this.stripe.assertEnabled();
    const token = randomUUID();
    const claim = await this.prisma.paymentOperation.updateMany({
      where: {
        id,
        status: "pending",
        nextRunAt: { lte: new Date() },
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
      },
      data: { leaseToken: token, leaseUntil: new Date(Date.now() + 120_000) },
    });
    if (!claim.count) return;
    const op = await this.prisma.paymentOperation.findUniqueOrThrow({
      where: { id },
    });
    if (op.kind === "completion") return this.runCompletion(op, token);
    if (op.firstCalledAt && Date.now() - op.firstCalledAt.getTime() >= DAY) {
      await this.coordination.withPayment(op.paymentId, async (tx) => {
        await tx.paymentOperation.update({
          where: { id },
          data: {
            status: "reconciliation_required",
            errorCode: "idempotency_window_elapsed",
            leaseUntil: null,
          },
        });
        await tx.payment.update({
          where: { id: op.paymentId },
          data: { reconciliationReason: "idempotency_window_elapsed" },
        });
      });
      return;
    }
    if (op.kind === "transfer" && !op.firstCalledAt) {
      // Eligibility may have changed while this durable operation was queued.
      const payment = await this.prisma.payment.findUniqueOrThrow({
        where: { id: op.paymentId },
      });
      let provider;
      try {
        provider = await this.connect.ensureEligible(payment.providerId);
      } catch (error) {
        const response = (
          error as { getResponse?: () => { code?: string } }
        ).getResponse?.();
        await this.prisma.paymentOperation.updateMany({
          where: { id, leaseToken: token },
          data: {
            errorCode: response?.code ?? "provider_verification_unavailable",
            leaseUntil: null,
            nextRunAt: new Date(Date.now() + 10_000),
          },
        });
        return;
      }
      if (
        provider.stripeAccountId !==
        (op.payload as unknown as Stripe.TransferCreateParams).destination
      ) {
        await this.coordination.withPayment(op.paymentId, async (tx) => {
          await tx.paymentOperation.update({
            where: { id },
            data: {
              status: "reconciliation_required",
              errorCode: "provider_account_changed",
              leaseUntil: null,
            },
          });
          await tx.payment.update({
            where: { id: op.paymentId },
            data: { reconciliationReason: "provider_account_changed" },
          });
        });
        return;
      }
      const allowed = await this.coordination.withPayment(
        op.paymentId,
        async (tx) => {
          const payment = await tx.payment.findUniqueOrThrow({
            where: { id: op.paymentId },
          });
          if (this.blocked(payment)) {
            await tx.paymentOperation.update({
              where: { id },
              data: {
                status: payment.reconciliationReason
                  ? "reconciliation_required"
                  : payment.status === "paid"
                    ? "pending"
                    : "failed",
                errorCode: "payout_blocked",
                leaseUntil: null,
                nextRunAt: new Date(Date.now() + 10_000),
              },
            });
            return false;
          }
          // This is the durable crossing of the external-call boundary. Later holds cause reversal.
          await tx.paymentOperation.update({
            where: { id },
            data: { firstCalledAt: new Date() },
          });
          return true;
        },
      );
      if (!allowed) return;
    } else if (!op.firstCalledAt) {
      await this.prisma.paymentOperation.update({
        where: { id },
        data: { firstCalledAt: new Date() },
      });
    }
    let externalId: string;
    try {
      if (op.kind === "transfer")
        externalId = (
          await this.stripe.createTransfer(
            op.payload as unknown as Stripe.TransferCreateParams,
            op.idempotencyKey,
          )
        ).id;
      else if (op.kind === "refund")
        externalId = (
          await this.stripe.createRefund(
            op.payload as unknown as Stripe.RefundCreateParams,
            op.idempotencyKey,
          )
        ).id;
      else if (op.kind === "reversal") {
        const payload = op.payload as unknown as {
          transferId: string;
          params: Stripe.TransferCreateReversalParams;
        };
        externalId = (
          await this.stripe.reverseTransfer(
            payload.transferId,
            payload.params,
            op.idempotencyKey,
          )
        ).id;
      } else throw new Error("Unknown payment operation");
    } catch (error) {
      const stripeError = error as { type?: string; code?: string };
      const retryableReversal =
        op.kind === "reversal" &&
        ["balance_insufficient", "insufficient_funds"].includes(
          stripeError.code ?? "",
        );
      const definitive =
        !retryableReversal &&
        [
          "StripeInvalidRequestError",
          "StripeCardError",
          "StripePermissionError",
          "StripeAuthenticationError",
        ].includes(stripeError.type ?? "");
      await this.prisma.paymentOperation.updateMany({
        where: { id, leaseToken: token },
        data: {
          status: definitive
            ? op.kind === "reversal"
              ? "reconciliation_required"
              : "failed"
            : "pending",
          errorCode: retryableReversal
            ? stripeError.code
            : definitive
              ? "stripe_rejected"
              : "stripe_outcome_uncertain",
          leaseUntil: null,
          nextRunAt: new Date(Date.now() + 10_000),
        },
      });
      throw error;
    }
    // DB finalization failure leaves the lease recoverable; retry the identical external request.
    await this.coordination.withPayment(op.paymentId, async (tx) => {
      const fresh = await tx.payment.findUniqueOrThrow({
        where: { id: op.paymentId },
      });
      await tx.paymentOperation.update({
        where: { id },
        data: {
          status: "succeeded",
          externalId,
          errorCode: null,
          leaseUntil: null,
          leaseToken: null,
        },
      });
      if (op.kind === "transfer") {
        const payload = op.payload as unknown as Stripe.TransferCreateParams;
        await tx.payment.update({
          where: { id: op.paymentId },
          data: {
            stripeTransferId: externalId,
            transferredAt: new Date(),
            stripeChargeId: payload.source_transaction,
          },
        });
        if (this.blocked(fresh))
          await this.enqueueReversal(
            tx,
            op.paymentId,
            externalId,
            "payment_hold",
          );
      } else if (op.kind === "reversal") {
        await tx.payment.update({
          where: { id: op.paymentId },
          data: {
            stripeTransferReversalId: externalId,
            transferReversedAt: new Date(),
          },
        });
      }
    });
  }

  private async runCompletion(op: PaymentOperation, token: string) {
    try {
      const transfer = await this.requestTransfer(op.paymentId);
      await this.runOperation(transfer.id);
      await this.coordination.withPayment(op.paymentId, async (tx) => {
        const currentTransfer = await tx.paymentOperation.findUniqueOrThrow({
          where: { id: transfer.id },
        });
        const payment = await tx.payment.findUniqueOrThrow({
          where: { id: op.paymentId },
          include: {
            booking: { include: { quote: { include: { request: true } } } },
            provider: true,
          },
        });
        if (
          currentTransfer.status === "pending" &&
          payment.status === "paid" &&
          !payment.transferReversedAt &&
          !payment.reconciliationReason
        ) {
          await tx.paymentOperation.update({
            where: { id: op.id },
            data: {
              status: "pending",
              errorCode: currentTransfer.errorCode,
              leaseUntil: null,
              nextRunAt: new Date(Date.now() + 10_000),
            },
          });
          return;
        }
        if (
          this.blocked(payment) ||
          payment.transferReversedAt ||
          ["failed", "reconciliation_required"].includes(currentTransfer.status)
        ) {
          await tx.paymentOperation.update({
            where: { id: op.id },
            data: {
              status:
                currentTransfer.status === "reconciliation_required"
                  ? "reconciliation_required"
                  : "failed",
              errorCode: currentTransfer.errorCode ?? "payout_blocked",
              leaseUntil: null,
            },
          });
          return;
        }
        if (currentTransfer.status !== "succeeded") {
          await tx.paymentOperation.update({
            where: { id: op.id },
            data: { leaseUntil: null, nextRunAt: new Date(Date.now() + 2000) },
          });
          return;
        }
        if (payment.booking.status !== "completed") {
          await tx.booking.update({
            where: { id: payment.bookingId },
            data: { status: "completed", completedAt: new Date() },
          });
          await tx.serviceRequest.update({
            where: { id: payment.booking.quote.requestId },
            data: { status: "completed" },
          });
          const request = payment.booking.quote.request;
          await tx.notification.createMany({
            data: [
              {
                userId: payment.customerId,
                type: "booking_completed",
                title: "Job completed",
                message: `Booking "${request.title}" is marked as completed.`,
                metadata: {
                  bookingId: payment.bookingId,
                  requestId: request.id,
                  requestTitle: request.title,
                  audience: "customer",
                },
              },
              {
                userId: payment.provider.userId,
                type: "booking_completed",
                title: "Job completed",
                message: `Booking "${request.title}" has been confirmed as completed.`,
                metadata: {
                  bookingId: payment.bookingId,
                  requestId: request.id,
                  requestTitle: request.title,
                  audience: "provider",
                },
              },
            ],
          });
        }
        await tx.paymentOperation.update({
          where: { id: op.id },
          data: { status: "succeeded", errorCode: null, leaseUntil: null },
        });
      });
    } catch (error) {
      const definitive =
        error instanceof BadRequestException ||
        error instanceof ConflictException;
      await this.prisma.paymentOperation.updateMany({
        where: { id: op.id, leaseToken: token },
        data: {
          status: definitive
            ? op.kind === "reversal"
              ? "reconciliation_required"
              : "failed"
            : "pending",
          errorCode: definitive ? "payout_blocked" : "completion_pending",
          leaseUntil: null,
          nextRunAt: new Date(Date.now() + 5000),
        },
      });
      if (!definitive) throw error;
    }
  }

  async drain(limit = 10) {
    const operations = await this.prisma.paymentOperation.findMany({
      where: {
        status: "pending",
        nextRunAt: { lte: new Date() },
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    for (const op of operations) {
      try {
        await this.runOperation(op.id);
      } catch {
        /* durable state drives the next run */
      }
    }
  }
}
