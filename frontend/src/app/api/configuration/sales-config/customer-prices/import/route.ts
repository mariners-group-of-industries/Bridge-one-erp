import { MAX_IMPORT_BYTES } from "@/features/configuration/entity-master-data/supplier/schemas/supplier.schema";
import { importPrices } from "@/features/configuration/sales-config/customer-price/server/customer-price-files";
import { AppError, badRequest } from "@/lib/api/errors";
import { apiHandler, ok } from "@/lib/api/handler";

/** Bulk upload for a tab. multipart/form-data with `file` (.xlsx) and `tab` (customer|group). */
export const POST = apiHandler("configuration:write", async (request, _context, actor) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw badRequest("Expected a multipart/form-data upload.");
  }
  const file = form.get("file");
  const tab = form.get("tab") === "group" ? "group" : "customer";
  if (!(file instanceof File)) throw badRequest("Choose an Excel file to upload.");
  if (file.size === 0) throw badRequest("The selected file is empty.");
  if (file.size > MAX_IMPORT_BYTES) throw new AppError(413, "PAYLOAD_TOO_LARGE", "Upload files must be 5 MB or smaller.");
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Upload an Excel .xlsx file (use the template).");
  return ok(await importPrices(actor, tab, new Uint8Array(await file.arrayBuffer())));
});
