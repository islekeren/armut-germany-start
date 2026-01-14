import { z } from "zod";

export const UserType = {
  CUSTOMER: "customer",
  PROVIDER: "provider",
  ADMIN: "admin",
} as const;

export type UserType = (typeof UserType)[keyof typeof UserType];

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  phone: z.string().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  userType: z.enum(["customer", "provider", "admin"]),
  profileImage: z.string().url().optional(),
  isVerified: z.boolean().default(false),
  gdprConsent: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type User = z.infer<typeof userSchema>;

export const createUserSchema = userSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isVerified: true,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  userType: z.enum(["customer", "provider"]),
  gdprConsent: z.boolean().refine((val) => val === true, {
    message: "GDPR consent is required",
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
