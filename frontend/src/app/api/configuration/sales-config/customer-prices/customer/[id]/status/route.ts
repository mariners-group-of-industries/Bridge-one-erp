import { z } from "zod";
import { setCustomerPriceActive } from "@/features/configuration/sales-config/customer-price/server/customer-price.service";
import { apiHandler, ok, parseId, parseJson } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

export const PATCH = apiHandler("configuration:write", async (request, context: Context, actor) => {
  const id = parseId((await context.params).id, "Customer price setup");
  const { isActive } = await parseJson(request, z.object({ isActive: z.boolean() }));
  return ok(await setCustomerPriceActive(actor, id, isActive));
});
