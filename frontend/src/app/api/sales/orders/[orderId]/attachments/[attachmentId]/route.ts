import { deleteOrderAttachment, readOrderAttachment } from "@/features/sales/orders/services/order-attachment.service";
import { apiHandler, noContent, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ orderId: string; attachmentId: string }> };

async function ids(context: Context) {
  const params = await context.params;
  return { id: parseId(params.orderId, "Sales order"), attachmentId: parseId(params.attachmentId, "Attachment") };
}

/** Streams the file through the API so access stays authorised. */
export const GET = apiHandler<Context>("sales:read", async (_request, context, actor) => {
  const { id, attachmentId } = await ids(context);
  const file = await readOrderAttachment(actor, id, attachmentId);
  return new Response(new Blob([new Uint8Array(file.bytes)], { type: file.mimeType }), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.bytes.byteLength),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
});

export const DELETE = apiHandler<Context>("sales:write", async (_request, context, actor) => {
  const { id, attachmentId } = await ids(context);
  await deleteOrderAttachment(actor, id, attachmentId);
  return noContent();
});
