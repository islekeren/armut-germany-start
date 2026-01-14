import { z } from "zod";

export const RequestStatus = {
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export type RequestStatus = (typeof RequestStatus)[keyof typeof RequestStatus];

export const serviceRequestSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  categoryId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string(),
  location: z.object({
    address: z.string(),
    city: z.string(),
    postalCode: z.string(),
    lat: z.number(),
    lng: z.number(),
  }),
  preferredDate: z.date().optional(),
  budgetMin: z.number().min(0).optional(),
  budgetMax: z.number().min(0).optional(),
  images: z.array(z.string().url()),
  status: z.enum(["open", "in_progress", "completed", "cancelled"]).default("open"),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ServiceRequest = z.infer<typeof serviceRequestSchema>;

export const createServiceRequestSchema = serviceRequestSchema.omit({
  id: true,
  customerId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateServiceRequestInput = z.infer<typeof createServiceRequestSchema>;
