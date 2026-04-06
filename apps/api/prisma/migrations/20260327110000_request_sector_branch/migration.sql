-- Add sector/branch taxonomy fields captured from the customer request flow.
ALTER TABLE "ServiceRequest"
ADD COLUMN "requestSector" TEXT,
ADD COLUMN "requestBranch" TEXT;
