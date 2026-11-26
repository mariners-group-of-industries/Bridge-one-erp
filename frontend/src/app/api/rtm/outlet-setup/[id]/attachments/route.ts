import { addOutletAttachment, listOutletAttachments } from "@/features/rtm/server/outlet.service";
import { validateAttachment } from "@/features/configuration/entity-master-data/supplier/server/supplier.service";
import { badRequest } from "@/lib/api/errors";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

/** The outlet's image and documents. */
export const GET = apiHandler("sales:read", async (_request, context: Context, actor) => ok(await listOutletAttachments(actor, parseId((await context.params).id, "Outlet"))));

/** POST multipart { file, kind: IMAGE | DOCUMENT }. PDF, PNG, JPEG or WebP, 5 MB at most. */
export const POST = apiHandler("sales:write", async (request, context: Context, actor) => {
  const id = parseId((await context.params).id, "Outlet");
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw badRequest("Expected a multipart/form-data upload.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("A file is required.");
  validateAttachment({ name: file.name, type: file.type, size: file.size });
  const bytes = new Uint8Array(await file.arrayBuffer());
  return ok(await addOutletAttachment(actor, id, String(form.get("kind") ?? ""), { name: file.name, type: file.type, size: bytes.byteLength, bytes }), 201);
});
