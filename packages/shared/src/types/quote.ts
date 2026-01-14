import { z } from "zod";

export const QuoteStatus = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  EXPIRED: "expired",
} as const;

export type QuoteStatus = (typeof QuoteStatus)[keyof typeof QuoteStatus];

export const quoteSchema = z.object({
  id: z.string().uuid(),
  requestId: z.string().uuid(),
  providerId: z.string().uuid(),
  price: z.number().min(0),
  message: z.string(),
  validUntil: z.date(),
  status: z.enum(["pending", "accepted", "rejected", "expired"]).default("pending"),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Quote = z.infer<typeof quoteSchema>;

export const createQuoteSchema = quoteSchema.omit({
  id: true,
  providerId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
