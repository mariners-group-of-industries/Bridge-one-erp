import { z } from "zod";
import { AppError } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import type { AssistantEvent, ChatMessage } from "../types";
import { LlmError, llmErrorMessage, streamCompletion, type LlmConfig, type LlmMessage, type ToolCall } from "./llm";
import { serializeResult, toolSpec, toolsFor, type AssistantTool } from "./tools";

/** Model calls per question; the last one gets no tools so it must answer. */
const MAX_ROUNDS = 5;

export function systemPrompt(now: Date): string {
  return `You are the Business Analyst built into BridgeOne ERP. Today is ${now.toISOString().slice(0, 10)}.
You help managers understand their business: sales, collections, customer dues, stock and trends.

Rules:
- Get every figure from your tools. Never invent, guess or estimate numbers. If the tools cannot answer, say which data is missing.
- Work out relative periods ("this month", "last quarter", "YTD") from today's date. sales_summary accepts at most 366 days.
- Think like an analyst: lead with the direct answer, then the 2-4 insights that matter most (trends, concentration, risks, outliers) and a concrete next step when it helps.
- Amounts are in the company's currency; write them with thousands separators and no currency symbol.
- Format for a small chat window: short paragraphs and "-" bullet lists, **bold** for key figures. No tables, no headings. Stay under about 200 words unless asked for detail.
- You can only read data. If asked to create, change or delete something, explain where in the ERP the user can do it.
- Reply in the language the user writes in.`;
}

export async function runAssistant(
  actor: Actor,
  config: LlmConfig,
  history: ChatMessage[],
  emit: (event: AssistantEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const tools = toolsFor(actor);
  const specs = tools.map(toolSpec);
  const messages: LlmMessage[] = [{ role: "system", content: systemPrompt(new Date()) }, ...history];

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const turn = await streamCompletion(
      config,
      { messages, tools: round < MAX_ROUNDS ? specs : undefined },
      (delta) => emit({ type: "text", delta }),
      signal,
    );
    if (!turn.toolCalls.length) return;

    // Text the model wrote before calling tools stays visible; separate it from the answer.
    if (turn.content.trim()) emit({ type: "text", delta: "\n\n" });
    messages.push({ role: "assistant", content: turn.content || null, tool_calls: turn.toolCalls });
    for (const call of turn.toolCalls) {
      const found = tools.find((t) => t.name === call.function.name);
      if (found) emit({ type: "status", text: found.status });
      messages.push({ role: "tool", tool_call_id: call.id, content: await runTool(actor, found, call) });
    }
  }
}

/** Runs one tool call; problems are returned as text so the model can correct itself. */
async function runTool(actor: Actor, found: AssistantTool | undefined, call: ToolCall): Promise<string> {
  if (!found) return `Error: there is no tool named "${call.function.name}".`;
  let raw: unknown;
  try {
    raw = call.function.arguments.trim() ? JSON.parse(call.function.arguments) : {};
  } catch {
    return "Error: the arguments were not valid JSON.";
  }
  const args = found.input.safeParse(raw);
  if (!args.success) return `Error: invalid arguments.\n${z.prettifyError(args.error)}`;
  try {
    return serializeResult(await found.run(actor, args.data));
  } catch (error) {
    if (error instanceof z.ZodError) return `Error: ${z.prettifyError(error)}`;
    if (error instanceof AppError) return `Error: ${error.message}`;
    console.error(`[assistant] tool ${found.name} failed`, error);
    return "Error: the lookup failed.";
  }
}

/** A message safe to show users for anything that stopped the answer. */
export function assistantErrorMessage(error: unknown): string {
  if (error instanceof LlmError) {
    console.error("[assistant]", error.message);
    return llmErrorMessage(error);
  }
  if (error instanceof AppError) return error.message;
  console.error("[assistant] unhandled error", error);
  return "Something went wrong while answering. Please try again.";
}
