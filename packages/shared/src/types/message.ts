import { z } from "zod";

export const conversationSchema = z.object({
  id: z.string().uuid(),
  requestId: z.string().uuid().optional(),
  participants: z.array(z.string().uuid()),
  lastMessageAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Conversation = z.infer<typeof conversationSchema>;

export const messageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  senderId: z.string().uuid(),
  content: z.string(),
  attachments: z.array(z.string().url()),
  readAt: z.date().optional(),
  createdAt: z.date(),
});

export type Message = z.infer<typeof messageSchema>;

export const createMessageSchema = messageSchema.omit({
  id: true,
  senderId: true,
  readAt: true,
  createdAt: true,
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
