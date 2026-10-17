import type { GroupPriceInput } from "@/features/configuration/sales-config/customer-price/schemas/customer-price.schema";
import { getGroupPrice, saveGroupPrice } from "@/features/configuration/sales-config/customer-price/server/customer-price.service";
import { badRequest } from "@/lib/api/errors";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

export const GET = apiHandler("configuration:read", async (_request, context: Context, actor) => {
  const id = parseId((await context.params).id, "Customer group price setup");
  return ok(await getGroupPrice(actor, id));
});

export const PUT = apiHandler("configuration:write", async (request, context: Context, actor) => {
  const id = parseId((await context.params).id, "Customer group price setup");
  const body = (await request.json().catch(() => {
    throw badRequest("Request body must be valid JSON.");
  })) as GroupPriceInput;
  return ok(await saveGroupPrice(actor, body, id));
});
