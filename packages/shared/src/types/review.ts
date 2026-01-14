import { z } from "zod";

export const reviewSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  reviewerId: z.string().uuid(),
  revieweeId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
  providerReply: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Review = z.infer<typeof reviewSchema>;

export const createReviewSchema = reviewSchema.omit({
  id: true,
  reviewerId: true,
  revieweeId: true,
  providerReply: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
