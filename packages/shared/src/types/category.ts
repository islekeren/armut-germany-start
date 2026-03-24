import { z } from "zod";

export const categorySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  nameDe: z.string(),
  nameEn: z.string(),
  icon: z.string(),
  parentId: z.string().uuid().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Category = z.infer<typeof categorySchema>;

export const createCategorySchema = categorySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
