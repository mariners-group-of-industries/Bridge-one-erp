import { deleteCollectionAttachment, readCollectionAttachment } from "@/features/sales/collections/services/collection-attachment.service";
import { apiHandler, noContent, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ collectionId: string; attachmentId: string }> };

async function ids(context: Context) {
  const params = await context.params;
  return { id: parseId(params.collectionId, "Collection"), attachmentId: parseId(params.attachmentId, "Attachment") };
}

/** Streams the file through the API so access stays authorised. */
export const GET = apiHandler<Context>("sales:read", async (_request, context, actor) => {
  const { id, attachmentId } = await ids(context);
  const file = await readCollectionAttachment(actor, id, attachmentId);
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
  await deleteCollectionAttachment(actor, id, attachmentId);
  return noContent();
});
