-- Hold provider transfers while a charge is disputed.
ALTER TABLE "Payment"
ADD COLUMN "disputedAt" TIMESTAMP(3);
