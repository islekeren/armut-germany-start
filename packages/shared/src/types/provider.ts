import { z } from "zod";

export const providerOpeningHourSchema = z.object({
  day: z.string(),
  closed: z.boolean(),
  open: z.string().nullable().optional(),
  close: z.string().nullable().optional(),
});

export const providerProfileSchema = z.object({
  id: z.string().uuid(),
  providerId: z.string().uuid(),
  slug: z.string(),
  headline: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  addressLine1: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  coverImage: z.string().nullable().optional(),
  phoneVisible: z.boolean().default(true),
  galleryImages: z.array(z.string()).default([]),
  highlights: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  openingHours: z.array(providerOpeningHourSchema).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const providerSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  companyName: z.string().optional(),
  taxId: z.string().optional(),
  description: z.string(),
  experienceYears: z.number().int().min(0),
  serviceAreaRadius: z.number().min(1).max(100), // km
  serviceAreaLat: z.number(),
  serviceAreaLng: z.number(),
  ratingAvg: z.number().min(0).max(5).default(0),
  totalReviews: z.number().int().min(0).default(0),
  isApproved: z.boolean().default(false),
  documents: z.array(z.string().url()),
  profile: providerProfileSchema.optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Provider = z.infer<typeof providerSchema>;

export const createProviderSchema = providerSchema.omit({
  id: true,
  userId: true,
  ratingAvg: true,
  totalReviews: true,
  isApproved: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateProviderInput = z.infer<typeof createProviderSchema>;
