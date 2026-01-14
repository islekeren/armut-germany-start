import { z } from "zod";

export const BookingStatus = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export const PaymentStatus = {
  PENDING: "pending",
  PAID: "paid",
  REFUNDED: "refunded",
  FAILED: "failed",
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const bookingSchema = z.object({
  id: z.string().uuid(),
  quoteId: z.string().uuid(),
  customerId: z.string().uuid(),
  providerId: z.string().uuid(),
  scheduledDate: z.date(),
  status: z.enum(["pending", "confirmed", "in_progress", "completed", "cancelled"]).default("pending"),
  totalPrice: z.number().min(0),
  paymentStatus: z.enum(["pending", "paid", "refunded", "failed"]).default("pending"),
  completedAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Booking = z.infer<typeof bookingSchema>;

export const createBookingSchema = bookingSchema.omit({
  id: true,
  customerId: true,
  providerId: true,
  status: true,
  paymentStatus: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
