import { deleteAttachment, readAttachment } from "@/features/configuration/entity-master-data/supplier/server/supplier.service";
import { apiHandler, noContent, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string; attachmentId: string }> };

async function ids(context: Context) {
  const params = await context.params;
  return { id: parseId(params.id, "Supplier"), attachmentId: parseId(params.attachmentId, "Attachment") };
}

/** Streams the file through the API so access stays authorised. */
export const GET = apiHandler("configuration:read", async (_request, context: Context, actor) => {
  const { id, attachmentId } = await ids(context);
  const file = await readAttachment(actor, id, attachmentId);
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

export const DELETE = apiHandler("configuration:write", async (_request, context: Context, actor) => {
  const { id, attachmentId } = await ids(context);
  await deleteAttachment(actor, id, attachmentId);
  return noContent();
});
