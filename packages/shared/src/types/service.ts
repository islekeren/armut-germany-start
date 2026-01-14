import { z } from "zod";

export const PriceType = {
  FIXED: "fixed",
  HOURLY: "hourly",
  QUOTE: "quote",
} as const;

export type PriceType = (typeof PriceType)[keyof typeof PriceType];

export const serviceSchema = z.object({
  id: z.string().uuid(),
  providerId: z.string().uuid(),
  categoryId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string(),
  priceType: z.enum(["fixed", "hourly", "quote"]),
  priceMin: z.number().min(0).optional(),
  priceMax: z.number().min(0).optional(),
  images: z.array(z.string().url()),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Service = z.infer<typeof serviceSchema>;

export const createServiceSchema = serviceSchema.omit({
  id: true,
  providerId: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
