import { createThanaSchema } from "@/features/configuration/entity-master-data/supplier/schemas/supplier.schema";
import { createThana } from "@/features/configuration/entity-master-data/supplier/server/supplier.service";
import { apiHandler, ok, parseJson } from "@/lib/api/handler";

/** Thanas are shared with the Supplier Profile. */
export const POST = apiHandler("configuration:write", async (request, _context, actor) => {
  const input = await parseJson(request, createThanaSchema);
  return ok(await createThana(actor, input), 201);
});
