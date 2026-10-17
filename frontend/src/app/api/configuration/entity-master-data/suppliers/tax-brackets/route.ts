import { createTaxBracketSchema } from "@/features/configuration/entity-master-data/supplier/schemas/supplier.schema";
import { createTaxBracket } from "@/features/configuration/entity-master-data/supplier/server/supplier.service";
import { apiHandler, ok, parseJson } from "@/lib/api/handler";

export const POST = apiHandler("configuration:write", async (request, _context, actor) => {
  const input = await parseJson(request, createTaxBracketSchema);
  return ok(await createTaxBracket(actor, input), 201);
});
