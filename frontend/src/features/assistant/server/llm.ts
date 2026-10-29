import { AppError } from "@/lib/api/errors";

/**
 * Minimal client for an OpenAI-compatible chat-completions endpoint. Defaults
 * to Hugging Face Inference Providers; point ASSISTANT_API_URL at a
 * self-hosted TGI / vLLM / Ollama server to keep data in-house.
 */

const DEFAULT_API_URL = "https://router.huggingface.co/v1";
/** Any chat model with tool calling works; larger models pick tools more reliably. */
const DEFAULT_MODEL = "Qwen/Qwen3-235B-A22B-Instruct-2507";

export interface LlmConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export type LlmMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface ToolSpec {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

/** The assistant's turn once the stream ends. */
export interface Completion {
  content: string;
  toolCalls: ToolCall[];
}

/** The upstream model service failed; `status` is its HTTP status. */
export class LlmError extends Error {
  constructor(
    readonly status: number,
    detail: string,
  ) {
    super(`Model request failed (${status}): ${detail.slice(0, 300)}`);
    this.name = "LlmError";
  }
}

export function llmConfig(): LlmConfig {
  const apiKey = process.env.HF_TOKEN;
  if (!apiKey) throw new AppError(503, "INTERNAL_ERROR", "The assistant is not set up yet: add HF_TOKEN to the server environment.");
  return {
    apiUrl: (process.env.ASSISTANT_API_URL || DEFAULT_API_URL).replace(/\/+$/, ""),
    apiKey,
    model: process.env.ASSISTANT_MODEL || DEFAULT_MODEL,
  };
}

/** A message safe to show users for a failed model call. */
export function llmErrorMessage(error: LlmError): string {
  switch (error.status) {
    case 401:
    case 403:
      return "The AI service rejected the access token. Ask an administrator to check HF_TOKEN.";
    case 402:
      return "The AI service's usage credits are used up. Ask an administrator to top them up.";
    case 404:
      return "The configured AI model is not available. Ask an administrator to check ASSISTANT_MODEL.";
    case 429:
    case 503:
      return "The AI service is busy right now. Please try again in a minute.";
    default:
      return "The AI service did not respond properly. Please try again.";
  }
}

/**
 * Streams one completion: text deltas go to `onText` as they arrive, tool-call
 * fragments are assembled and returned with the full text.
 */
export async function streamCompletion(
  config: LlmConfig,
  request: { messages: LlmMessage[]; tools?: ToolSpec[] },
  onText: (delta: string) => void,
  signal?: AbortSignal,
): Promise<Completion> {
  const response = await fetch(`${config.apiUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      messages: request.messages,
      ...(request.tools?.length ? { tools: request.tools, tool_choice: "auto" } : {}),
      stream: true,
      temperature: 0.2,
      max_tokens: 1500,
    }),
    signal,
  });
  if (!response.ok || !response.body) throw new LlmError(response.status, await response.text().catch(() => ""));

  let content = "";
  const calls: ToolCall[] = [];
  for await (const chunk of serverSentEvents(response.body)) {
    if (chunk.error) throw new LlmError(502, JSON.stringify(chunk.error));
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) continue;
    if (delta.content) {
      content += delta.content;
      onText(delta.content);
    }
    for (const fragment of delta.tool_calls ?? []) {
      const index = fragment.index ?? calls.length;
      const call = (calls[index] ??= { id: "", type: "function", function: { name: "", arguments: "" } });
      if (fragment.id) call.id = fragment.id;
      if (fragment.function?.name) call.function.name += fragment.function.name;
      if (fragment.function?.arguments) call.function.arguments += fragment.function.arguments;
    }
  }
  const toolCalls = calls.filter(Boolean).map((call, index) => ({ ...call, id: call.id || `call_${index}` }));
  return { content, toolCalls };
}

interface StreamChunk {
  error?: unknown;
  choices?: {
    delta?: {
      content?: string | null;
      tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[];
    };
  }[];
}

/** Parses the `data: {...}` lines of an SSE body until `data: [DONE]`. */
async function* serverSentEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const data = line.startsWith("data:") ? line.slice(5).trim() : "";
        if (!data) continue;
        if (data === "[DONE]") return;
        try {
          yield JSON.parse(data) as StreamChunk;
        } catch {
          // Keep-alive comments and partial frames carry nothing we need.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
