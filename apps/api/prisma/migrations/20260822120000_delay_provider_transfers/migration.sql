-- Persist the source charge and delayed provider transfer lifecycle.
ALTER TABLE "Payment"
ADD COLUMN "stripeChargeId" TEXT,
ADD COLUMN "stripeTransferId" TEXT,
ADD COLUMN "stripeTransferReversalId" TEXT,
ADD COLUMN "transferredAt" TIMESTAMP(3),
ADD COLUMN "transferReversedAt" TIMESTAMP(3);

ALTER TABLE "Provider"
ADD COLUMN "stripePayoutsEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "Payment_stripeChargeId_key" ON "Payment"("stripeChargeId");
CREATE UNIQUE INDEX "Payment_stripeTransferId_key" ON "Payment"("stripeTransferId");
CREATE UNIQUE INDEX "Payment_stripeTransferReversalId_key" ON "Payment"("stripeTransferReversalId");
