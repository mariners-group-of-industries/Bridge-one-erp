import { MAX_IMPORT_BYTES } from "@/features/configuration/entity-master-data/supplier/schemas/supplier.schema";
import { importCustomers, importTree } from "@/features/configuration/sales-config/territory/server/territory-files";
import { AppError, badRequest } from "@/lib/api/errors";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

/** Excel upload: multipart/form-data with `file`, `businessUnitId` and `kind` (tree|customers). */
export const POST = apiHandler("configuration:write", async (request, _context, actor) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw badRequest("Expected a multipart/form-data upload.");
  }
  const file = form.get("file");
  const businessUnitId = parseId(String(form.get("businessUnitId") ?? ""), "Business unit");
  const kind = form.get("kind") === "customers" ? "customers" : "tree";
  if (!(file instanceof File)) throw badRequest("Choose an Excel file to upload.");
  if (file.size === 0) throw badRequest("The selected file is empty.");
  if (file.size > MAX_IMPORT_BYTES) throw new AppError(413, "PAYLOAD_TOO_LARGE", "Upload files must be 5 MB or smaller.");
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Upload an Excel .xlsx file.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  return ok(kind === "tree" ? await importTree(actor, businessUnitId, bytes) : await importCustomers(actor, businessUnitId, bytes));
});
