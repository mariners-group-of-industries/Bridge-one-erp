import { createNamedOptionSchema } from "@/features/configuration/entity-master-data/item/schemas/item.schema";
import { createDivision } from "@/features/configuration/entity-master-data/item/server/item.service";
import { apiHandler, ok, parseJson } from "@/lib/api/handler";

export const POST = apiHandler("configuration:write", async (request, _context, actor) => {
  const input = await parseJson(request, createNamedOptionSchema);
  return ok(await createDivision(actor, input), 201);
});
