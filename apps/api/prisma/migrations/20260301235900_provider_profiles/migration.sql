-- CreateTable
CREATE TABLE "ProviderProfile" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "headline" TEXT,
    "bio" TEXT,
    "addressLine1" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "website" TEXT,
    "coverImage" TEXT,
    "phoneVisible" BOOLEAN NOT NULL DEFAULT true,
    "galleryImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "openingHours" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderProfile_providerId_key" ON "ProviderProfile"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderProfile_slug_key" ON "ProviderProfile"("slug");

-- CreateIndex
CREATE INDEX "ProviderProfile_slug_idx" ON "ProviderProfile"("slug");

-- AddForeignKey
ALTER TABLE "ProviderProfile" ADD CONSTRAINT "ProviderProfile_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
