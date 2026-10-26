import { createSupplierGroupSchema } from "@/features/configuration/entity-master-data/supplier/schemas/supplier.schema";
import { createSupplierGroup } from "@/features/configuration/entity-master-data/supplier/server/supplier.service";
import { apiHandler, ok, parseJson } from "@/lib/api/handler";

/** "+ Add new" Partner Group (no parentId) or Sub Group (with parentId). */
export const POST = apiHandler("configuration:write", async (request, _context, actor) => {
  const input = await parseJson(request, createSupplierGroupSchema);
  return ok(await createSupplierGroup(actor, input), 201);
});
