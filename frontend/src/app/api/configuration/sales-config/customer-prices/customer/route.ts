import type { CustomerPriceInput } from "@/features/configuration/sales-config/customer-price/schemas/customer-price.schema";
import { saveCustomerPrice } from "@/features/configuration/sales-config/customer-price/server/customer-price.service";
import { badRequest } from "@/lib/api/errors";
import { apiHandler, ok } from "@/lib/api/handler";

/** Save a customer's prices (replaces the setup for the same customer and price type). */
export const POST = apiHandler("configuration:write", async (request, _context, actor) => {
  const body = (await request.json().catch(() => {
    throw badRequest("Request body must be valid JSON.");
  })) as CustomerPriceInput;
  return ok(await saveCustomerPrice(actor, body), 201);
});
