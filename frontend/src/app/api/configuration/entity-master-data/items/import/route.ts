import { importItems } from "@/features/configuration/entity-master-data/item/server/item-excel";
import { MAX_IMPORT_BYTES } from "@/features/configuration/entity-master-data/supplier/schemas/supplier.schema";
import { AppError, badRequest } from "@/lib/api/errors";
import { apiHandler, ok } from "@/lib/api/handler";

/** Bulk upload. Expects multipart/form-data with one .xlsx `file`. */
export const POST = apiHandler("configuration:write", async (request, _context, actor) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw badRequest("Expected a multipart/form-data upload.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("Choose an Excel file to upload.");
  if (file.size === 0) throw badRequest("The selected file is empty.");
  if (file.size > MAX_IMPORT_BYTES) throw new AppError(413, "PAYLOAD_TOO_LARGE", "Upload files must be 5 MB or smaller.");
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Upload an Excel .xlsx file (use the template).");
  }
  return ok(await importItems(actor, new Uint8Array(await file.arrayBuffer())));
});
