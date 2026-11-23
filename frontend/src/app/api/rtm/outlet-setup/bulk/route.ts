import { bulkCreateOutlets } from "@/features/rtm/server/outlet.service";
import { badRequest } from "@/lib/api/errors";
import { apiHandler, ok } from "@/lib/api/handler";

/** POST multipart { file (.xlsx) }: outlets from the upload template (each waits for approval). */
export const POST = apiHandler("sales:write", async (request, _c, actor) => {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw badRequest("Choose the Excel file to upload.");
  if (file.size > 10 * 1024 * 1024) throw badRequest("The file is larger than 10 MB.");
  return ok(await bulkCreateOutlets(actor, new Uint8Array(await file.arrayBuffer())), 201);
});
