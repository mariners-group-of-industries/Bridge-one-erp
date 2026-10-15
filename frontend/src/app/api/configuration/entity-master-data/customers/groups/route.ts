import { createCustomerGroupSchema } from "@/features/configuration/entity-master-data/customer/schemas/customer.schema";
import { createCustomerGroup } from "@/features/configuration/entity-master-data/customer/server/customer.service";
import { apiHandler, ok, parseJson } from "@/lib/api/handler";

/** "+ Add new" Partner Group (no parentId) or Sub Group (with parentId). */
export const POST = apiHandler("configuration:write", async (request, _context, actor) => {
  const input = await parseJson(request, createCustomerGroupSchema);
  return ok(await createCustomerGroup(actor, input), 201);
});
