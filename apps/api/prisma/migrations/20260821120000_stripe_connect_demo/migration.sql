-- CreateEnum
CREATE TYPE "StripeOnboardingStatus" AS ENUM ('not_started', 'pending', 'restricted', 'ready');

-- Extend Provider with Stripe Connect state
ALTER TABLE "Provider"
ADD COLUMN "stripeAccountId" TEXT,
ADD COLUMN "stripeOnboardingStatus" "StripeOnboardingStatus" NOT NULL DEFAULT 'not_started',
ADD COLUMN "stripeTransfersEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "stripeRequirementsDue" JSONB,
ADD COLUMN "stripeOnboardedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Provider_stripeAccountId_key" ON "Provider"("stripeAccountId");

-- Add the new payment snapshot columns as nullable so existing rows can be backfilled safely.
ALTER TABLE "Payment"
ADD COLUMN "providerId" TEXT,
ADD COLUMN "customerId" TEXT,
ADD COLUMN "stripeCheckoutSessionId" TEXT,
ADD COLUMN "stripePaymentIntentId" TEXT,
ADD COLUMN "checkoutAttempt" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "grossAmount" INTEGER,
ADD COLUMN "platformFeeAmount" INTEGER,
ADD COLUMN "providerAmount" INTEGER,
ADD COLUMN "paidAt" TIMESTAMP(3),
ADD COLUMN "failedAt" TIMESTAMP(3),
ADD COLUMN "refundedAt" TIMESTAMP(3);

UPDATE "Payment" AS payment
SET
  "providerId" = booking."providerId",
  "customerId" = booking."customerId",
  "stripePaymentIntentId" = payment."stripePaymentId",
  "grossAmount" = ROUND(payment."amount" * 100)::INTEGER,
  "platformFeeAmount" = ROUND(ROUND(payment."amount" * 100) * 0.15)::INTEGER,
  "providerAmount" = ROUND(payment."amount" * 100)::INTEGER - ROUND(ROUND(payment."amount" * 100) * 0.15)::INTEGER,
  "currency" = LOWER(payment."currency"),
  "paidAt" = CASE WHEN payment."status" = 'paid' THEN payment."updatedAt" ELSE NULL END,
  "failedAt" = CASE WHEN payment."status" = 'failed' THEN payment."updatedAt" ELSE NULL END,
  "refundedAt" = CASE WHEN payment."status" = 'refunded' THEN payment."updatedAt" ELSE NULL END
FROM "Booking" AS booking
WHERE booking."id" = payment."bookingId";

ALTER TABLE "Payment"
ALTER COLUMN "providerId" SET NOT NULL,
ALTER COLUMN "customerId" SET NOT NULL,
ALTER COLUMN "grossAmount" SET NOT NULL,
ALTER COLUMN "platformFeeAmount" SET NOT NULL,
ALTER COLUMN "providerAmount" SET NOT NULL,
ALTER COLUMN "currency" SET DEFAULT 'eur',
ALTER COLUMN "status" DROP DEFAULT,
ALTER COLUMN "status" TYPE "PaymentStatus"
USING (
  CASE
    WHEN "status" IN ('pending', 'paid', 'refunded', 'failed')
      THEN "status"::"PaymentStatus"
    ELSE 'pending'::"PaymentStatus"
  END
),
ALTER COLUMN "status" SET DEFAULT 'pending';

DROP INDEX IF EXISTS "Payment_stripePaymentId_idx";

ALTER TABLE "Payment"
DROP COLUMN "stripePaymentId",
DROP COLUMN "amount";

CREATE UNIQUE INDEX "Payment_stripeCheckoutSessionId_key" ON "Payment"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "Payment_stripePaymentIntentId_key" ON "Payment"("stripePaymentIntentId");
CREATE INDEX "Payment_providerId_idx" ON "Payment"("providerId");
CREATE INDEX "Payment_customerId_idx" ON "Payment"("customerId");
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Persist processed Stripe events to make webhook handling idempotent.
CREATE TABLE "StripeWebhookEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);
