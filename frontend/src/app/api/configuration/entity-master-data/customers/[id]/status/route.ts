import { z } from "zod";
import { setCustomerActive } from "@/features/configuration/entity-master-data/customer/server/customer.service";
import { apiHandler, ok, parseId, parseJson } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

const statusSchema = z.object({ isActive: z.boolean() });

/** Active/Inactive toggle from the customer list. */
export const PATCH = apiHandler("configuration:write", async (request, context: Context, actor) => {
  const id = parseId((await context.params).id, "Customer");
  const { isActive } = await parseJson(request, statusSchema);
  return ok(await setCustomerActive(actor, id, isActive));
});
