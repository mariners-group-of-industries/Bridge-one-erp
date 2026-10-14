import type { OpeningStockInput } from "@/features/configuration/entity-master-data/item/schemas/item.schema";
import { createOpeningStock } from "@/features/configuration/entity-master-data/item/server/item.service";
import { badRequest } from "@/lib/api/errors";
import { apiHandler, ok } from "@/lib/api/handler";

export const POST = apiHandler("configuration:write", async (request, _context, actor) => {
  const body = (await request.json().catch(() => {
    throw badRequest("Request body must be valid JSON.");
  })) as OpeningStockInput;
  // The service validates the body with the shared schema.
  return ok(await createOpeningStock(actor, body), 201);
});
