ALTER TABLE "PaymentAttempt" ADD COLUMN "failureConfirmed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StripeWebhookEvent" ADD COLUMN "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "StripeWebhookEvent_processedAt_nextRunAt_idx" ON "StripeWebhookEvent"("processedAt", "nextRunAt");
