import { z } from "zod";
import { setGroupPriceRunning } from "@/features/configuration/sales-config/customer-price/server/customer-price.service";
import { apiHandler, ok, parseId, parseJson } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

/** "Is price running?" toggle from the Customer Offer list. */
export const PATCH = apiHandler("configuration:write", async (request, context: Context, actor) => {
  const id = parseId((await context.params).id, "Customer group price setup");
  const { isRunning } = await parseJson(request, z.object({ isRunning: z.boolean() }));
  return ok(await setGroupPriceRunning(actor, id, isRunning));
});
