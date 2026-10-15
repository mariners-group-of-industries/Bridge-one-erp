import type { GroupPriceInput } from "@/features/configuration/sales-config/customer-price/schemas/customer-price.schema";
import { saveGroupPrice } from "@/features/configuration/sales-config/customer-price/server/customer-price.service";
import { badRequest } from "@/lib/api/errors";
import { apiHandler, ok } from "@/lib/api/handler";

export const POST = apiHandler("configuration:write", async (request, _context, actor) => {
  const body = (await request.json().catch(() => {
    throw badRequest("Request body must be valid JSON.");
  })) as GroupPriceInput;
  return ok(await saveGroupPrice(actor, body), 201);
});
