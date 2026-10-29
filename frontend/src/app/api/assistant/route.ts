import { assistantErrorMessage, runAssistant } from "@/features/assistant/server/agent";
import { llmConfig } from "@/features/assistant/server/llm";
import { assistantRequestSchema, type AssistantEvent } from "@/features/assistant/types";
import { apiHandler, parseJson } from "@/lib/api/handler";

/**
 * Business Analyst chat. Streams newline-delimited JSON `AssistantEvent`s.
 * Every tool checks its own permission; Sales read access opens the chat.
 */
export const POST = apiHandler("sales:read", async (request, _context, actor) => {
  const { messages } = await parseJson(request, assistantRequestSchema);
  const config = llmConfig();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AssistantEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // The browser went away (Stop or closed tab); nothing left to send to.
        }
      };
      try {
        await runAssistant(actor, config, messages, emit, request.signal);
        emit({ type: "done" });
      } catch (error) {
        if (!request.signal.aborted) emit({ type: "error", message: assistantErrorMessage(error) });
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed by a cancelled request.
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
});
