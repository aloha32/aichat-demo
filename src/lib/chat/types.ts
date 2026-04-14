import { z } from "zod";

export const STORAGE_VERSION = 1;

export const messageRoleSchema = z.enum(["user", "assistant"]);
export const messageStatusSchema = z.enum(["done", "streaming", "error"]);

export const conversationSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const chatMessageSchema = z.object({
  id: z.string().min(1),
  conversationId: z.string().min(1),
  role: messageRoleSchema,
  content: z.string(),
  createdAt: z.string().min(1),
  status: messageStatusSchema,
  error: z.string().min(1).optional(),
});

export const chatStoreSchema = z.object({
  version: z.literal(STORAGE_VERSION),
  activeConversationId: z.string().nullable(),
  conversations: z.array(conversationSchema),
  messagesByConversation: z.record(z.string(), z.array(chatMessageSchema)),
});

export const apiMessageSchema = z.object({
  role: messageRoleSchema,
  content: z.string().trim().min(1).max(12_000),
});

export const chatRequestSchema = z.object({
  conversationId: z.string().min(1),
  messages: z.array(apiMessageSchema).min(1).max(48),
  model: z.string().trim().min(1).max(100).optional(),
  systemPrompt: z.string().trim().min(1).max(2_000).optional(),
});

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  provider: z.string().min(1),
  model: z.string().min(1),
  timestamp: z.string().min(1),
});

export const DEFAULT_SYSTEM_PROMPT =
  "你是一个简洁、务实、表达清晰的中文 AI 助手。";

export type MessageRole = z.infer<typeof messageRoleSchema>;
export type MessageStatus = z.infer<typeof messageStatusSchema>;
export type ChatConversation = z.infer<typeof conversationSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatStore = z.infer<typeof chatStoreSchema>;
export type ApiMessage = z.infer<typeof apiMessageSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
