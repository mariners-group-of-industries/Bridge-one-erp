import { z } from "zod";

/** Messages the browser keeps and sends back on every question. */
export const MAX_HISTORY = 20;

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000, { error: "Keep each message under 4,000 characters." }),
});

/** Body of POST /api/assistant (shared by the route and the browser). */
export const assistantRequestSchema = z.object({
  messages: z
    .array(chatMessageSchema)
    .min(1)
    .max(MAX_HISTORY)
    .refine((messages) => messages.at(-1)?.role === "user", { error: "The last message must be a question." }),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

/** One line of the newline-delimited JSON stream the route returns. */
export type AssistantEvent =
  | { type: "status"; text: string }
  | { type: "text"; delta: string }
  | { type: "error"; message: string }
  | { type: "done" };
