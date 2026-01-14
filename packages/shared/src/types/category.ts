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

// Predefined categories for Germany
export const CATEGORIES = [
  { slug: "reinigung", nameDe: "Reinigung", nameEn: "Cleaning", icon: "cleaning" },
  { slug: "umzug", nameDe: "Umzug", nameEn: "Moving", icon: "moving" },
  { slug: "renovierung", nameDe: "Renovierung", nameEn: "Renovation", icon: "renovation" },
  { slug: "garten", nameDe: "Garten", nameEn: "Garden", icon: "garden" },
  { slug: "elektriker", nameDe: "Elektriker", nameEn: "Electrician", icon: "electric" },
  { slug: "klempner", nameDe: "Klempner", nameEn: "Plumber", icon: "plumbing" },
  { slug: "maler", nameDe: "Maler", nameEn: "Painter", icon: "paint" },
  { slug: "schlosser", nameDe: "Schlosser", nameEn: "Locksmith", icon: "lock" },
  { slug: "nachhilfe", nameDe: "Nachhilfe", nameEn: "Tutoring", icon: "education" },
  { slug: "fotografie", nameDe: "Fotografie", nameEn: "Photography", icon: "camera" },
] as const;
