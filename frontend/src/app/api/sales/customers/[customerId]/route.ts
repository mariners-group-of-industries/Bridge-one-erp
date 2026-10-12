import { updateCustomer } from "@/features/sales/masters/services/masters.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

export const PUT = apiHandler<{ params: Promise<{ customerId: string }> }>("sales:write", async (request, context, actor) => {
  const id = parseId((await context.params).customerId, "Customer");
  return ok(await updateCustomer(actor, id, await request.json().catch(() => null)));
});
