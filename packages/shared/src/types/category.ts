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
  { slug: "cleaning", nameDe: "Cleaning", nameEn: "Cleaning", icon: "cleaning" },
  { slug: "moving", nameDe: "Moving", nameEn: "Moving", icon: "moving" },
  { slug: "renovation", nameDe: "Renovation", nameEn: "Renovation", icon: "renovation" },
  { slug: "garden", nameDe: "Garden", nameEn: "Garden", icon: "garden" },
  { slug: "electrician", nameDe: "Electrician", nameEn: "Electrician", icon: "electric" },
  { slug: "plumber", nameDe: "Plumber", nameEn: "Plumber", icon: "plumbing" },
  { slug: "painter", nameDe: "Painter", nameEn: "Painter", icon: "paint" },
  { slug: "locksmith", nameDe: "Locksmith", nameEn: "Locksmith", icon: "lock" },
  { slug: "tutoring", nameDe: "Tutoring", nameEn: "Tutoring", icon: "education" },
  { slug: "photography", nameDe: "Photography", nameEn: "Photography", icon: "camera" },
] as const;
