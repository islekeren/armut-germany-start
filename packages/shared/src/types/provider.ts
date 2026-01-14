import { z } from "zod";

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
