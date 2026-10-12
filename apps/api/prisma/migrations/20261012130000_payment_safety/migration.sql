-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "activeAttemptId" TEXT,
ADD COLUMN     "paidAttemptId" TEXT,
ADD COLUMN     "reconciliationReason" TEXT,
ADD COLUMN     "refundRequestedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StripeWebhookEvent" ADD COLUMN     "payload" JSONB,
ADD COLUMN     "unresolved" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'creating',
    "grossAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "payload" JSONB,
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeChargeId" TEXT,
    "checkoutUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "firstCalledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentOperation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "externalId" TEXT,
    "errorCode" TEXT,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "firstCalledAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentDispute" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "stripeChargeId" TEXT,
    "stripePaymentIntentId" TEXT,
    "status" TEXT NOT NULL,
    "eventCreated" INTEGER NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentDispute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_stripeCheckoutSessionId_key" ON "PaymentAttempt"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_stripePaymentIntentId_key" ON "PaymentAttempt"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_stripeChargeId_key" ON "PaymentAttempt"("stripeChargeId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_status_leaseUntil_idx" ON "PaymentAttempt"("status", "leaseUntil");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_paymentId_sequence_key" ON "PaymentAttempt"("paymentId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOperation_idempotencyKey_key" ON "PaymentOperation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentOperation_status_nextRunAt_leaseUntil_idx" ON "PaymentOperation"("status", "nextRunAt", "leaseUntil");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOperation_paymentId_kind_key" ON "PaymentOperation"("paymentId", "kind");

-- CreateIndex
CREATE INDEX "PaymentDispute_paymentId_idx" ON "PaymentDispute"("paymentId");

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentOperation" ADD CONSTRAINT "PaymentOperation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentDispute" ADD CONSTRAINT "PaymentDispute_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Preserve legacy financial object associations; never match an old event by paymentId alone.
INSERT INTO "PaymentAttempt" (id, "paymentId", sequence, status, "grossAmount", currency,
  "stripeCheckoutSessionId", "stripePaymentIntentId", "stripeChargeId", "paidAt", "failedAt", "refundedAt", "createdAt", "updatedAt")
SELECT 'legacy:' || id, id, "checkoutAttempt",
  CASE WHEN status = 'paid' THEN 'paid' WHEN status = 'refunded' THEN 'paid' ELSE 'open' END,
  "grossAmount", currency, "stripeCheckoutSessionId", "stripePaymentIntentId", "stripeChargeId", "paidAt", "failedAt", "refundedAt", "createdAt", "updatedAt"
FROM "Payment" WHERE "stripeCheckoutSessionId" IS NOT NULL OR "stripePaymentIntentId" IS NOT NULL;
UPDATE "Payment" SET "activeAttemptId" = 'legacy:' || id,
  "paidAttemptId" = CASE WHEN status IN ('paid', 'refunded') THEN 'legacy:' || id ELSE NULL END
WHERE "stripeCheckoutSessionId" IS NOT NULL OR "stripePaymentIntentId" IS NOT NULL;
-- Existing disputes lack a remote identity; retain their holds until explicitly reconciled.
UPDATE "Payment" SET "reconciliationReason" = 'legacy_dispute_requires_reconciliation' WHERE "disputedAt" IS NOT NULL;
