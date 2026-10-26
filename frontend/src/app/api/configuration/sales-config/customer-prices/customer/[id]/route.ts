import type { CustomerPriceInput } from "@/features/configuration/sales-config/customer-price/schemas/customer-price.schema";
import { getCustomerPrice, saveCustomerPrice } from "@/features/configuration/sales-config/customer-price/server/customer-price.service";
import { badRequest } from "@/lib/api/errors";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

export const GET = apiHandler("configuration:read", async (_request, context: Context, actor) => {
  const id = parseId((await context.params).id, "Customer price setup");
  return ok(await getCustomerPrice(actor, id));
});

export const PUT = apiHandler("configuration:write", async (request, context: Context, actor) => {
  const id = parseId((await context.params).id, "Customer price setup");
  const body = (await request.json().catch(() => {
    throw badRequest("Request body must be valid JSON.");
  })) as CustomerPriceInput;
  return ok(await saveCustomerPrice(actor, body, id));
});
