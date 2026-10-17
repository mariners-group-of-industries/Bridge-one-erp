import { validateAttachment } from "@/features/configuration/entity-master-data/supplier/server/supplier.service";
import { readWalletAttachment, removeWalletAttachment, setWalletAttachment } from "@/features/configuration/sales-config/wallet/server/wallet.service";
import { badRequest } from "@/lib/api/errors";
import { apiHandler, noContent, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };
const idOf = async (context: Context) => parseId((await context.params).id, "Wallet");

/** Upload (or replace) the attachment. multipart/form-data with a single `file` field. */
export const POST = apiHandler("configuration:write", async (request, context: Context, actor) => {
  const id = await idOf(context);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw badRequest("Expected a multipart/form-data upload.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("A file is required.");
  // Reject on declared size/type before buffering the content.
  validateAttachment({ name: file.name, type: file.type, size: file.size });
  const bytes = new Uint8Array(await file.arrayBuffer());
  return ok(await setWalletAttachment(actor, id, { name: file.name, type: file.type, size: bytes.byteLength, bytes }));
});

/** Streams the file through the API so access stays authorised. */
export const GET = apiHandler("configuration:read", async (_request, context: Context, actor) => {
  const file = await readWalletAttachment(actor, await idOf(context));
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
  await removeWalletAttachment(actor, await idOf(context));
  return noContent();
});
