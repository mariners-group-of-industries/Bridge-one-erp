import { apiHandler, ok } from "@/lib/api/handler";
import { MAX_IMPORT_BYTES } from "@/features/configuration/entity-master-data/supplier/schemas/supplier.schema";
import { AppError, badRequest } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import type { Permission } from "@/lib/auth/actor";

export interface ImportResult {
  created: number;
  errors: { row: number; message: string }[];
  notes?: string[];
}

interface BulkImportHandlers<TActor extends Actor = Actor> {
  /** Permission for the GET (template download). */
  read: Permission;
  /** Permission for the POST (file upload). */
  write: Permission;
  /** Template filename without extension, e.g. "goods-receipts-template". */
  templateName: string;
  template: () => Promise<Uint8Array>;
  importFile: (actor: TActor, actorName: string, bytes: Uint8Array) => Promise<ImportResult>;
}

/**
 * GET /import — downloads the .xlsx template; POST /import — imports a filled
 * template. Both wrapped in apiHandler so anonymous requests get 401 and the
 * api-auth test passes.
 */
export function bulkImportRoute(handlers: BulkImportHandlers) {
  const headers = (name: string) => ({
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${name}.xlsx"`,
  });

  const GET = apiHandler(handlers.read, async () => {
    const bytes = await handlers.template();
    return new Response(Buffer.from(bytes), { headers: headers(handlers.templateName) });
  });

  const POST = apiHandler(handlers.write, async (request, _context, actor) => {
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
    const actorName = actor.name ?? actor.id;
    return ok(await handlers.importFile(actor, actorName, new Uint8Array(await file.arrayBuffer())));
  });

  return { GET, POST };
}
