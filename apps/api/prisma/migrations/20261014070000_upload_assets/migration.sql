CREATE TABLE "UploadAsset" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "folder" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "size" INTEGER NOT NULL,
  "mimetype" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UploadAsset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UploadAsset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UploadAsset_key_key" ON "UploadAsset"("key");
CREATE INDEX "UploadAsset_ownerId_createdAt_idx" ON "UploadAsset"("ownerId", "createdAt");
CREATE INDEX "UploadAsset_status_expiresAt_idx" ON "UploadAsset"("status", "expiresAt");
