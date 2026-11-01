import { validateAttachment } from "@/features/configuration/entity-master-data/supplier/server/supplier.service";
import { addCollectionAttachment } from "@/features/sales/collections/services/collection-attachment.service";
import { badRequest } from "@/lib/api/errors";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ collectionId: string }> };

/** Upload one attachment. Expects multipart/form-data with a single `file` field. */
export const POST = apiHandler<Context>("sales:write", async (request, context, actor) => {
  const id = parseId((await context.params).collectionId, "Collection");
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
  return ok(await addCollectionAttachment(actor, id, { name: file.name, type: file.type, size: bytes.byteLength, bytes }), 201);
});
