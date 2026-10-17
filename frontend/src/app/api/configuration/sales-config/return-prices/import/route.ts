import { z } from "zod";
import { MAX_IMPORT_BYTES } from "@/features/configuration/entity-master-data/supplier/schemas/supplier.schema";
import { importReturnPrices } from "@/features/configuration/sales-config/return-price/server/return-price-files";
import { AppError, badRequest } from "@/lib/api/errors";
import { apiHandler, ok } from "@/lib/api/handler";

/** Bulk upload. multipart/form-data with `file` (.xlsx) and `businessUnitId`. */
export const POST = apiHandler("configuration:write", async (request, _context, actor) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw badRequest("Expected a multipart/form-data upload.");
  }
  const file = form.get("file");
  const businessUnitId = z.uuid().safeParse(form.get("businessUnitId"));
  if (!businessUnitId.success) throw badRequest("Select a business unit.");
  if (!(file instanceof File)) throw badRequest("Choose an Excel file to upload.");
  if (file.size === 0) throw badRequest("The selected file is empty.");
  if (file.size > MAX_IMPORT_BYTES) throw new AppError(413, "PAYLOAD_TOO_LARGE", "Upload files must be 5 MB or smaller.");
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Upload an Excel .xlsx file (use the downloaded Excel).");
  return ok(await importReturnPrices(actor, businessUnitId.data, new Uint8Array(await file.arrayBuffer())));
});
