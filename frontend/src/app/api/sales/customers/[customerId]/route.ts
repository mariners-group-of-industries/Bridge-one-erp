import { updateCustomer } from "@/features/sales/masters/services/masters.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

export const PUT = apiHandler<RouteContext<"/api/sales/customers/[customerId]">>("sales:write", async (request, context, actor) => {
  const id = parseId((await context.params).customerId, "Customer");
  return ok(await updateCustomer(actor, id, await request.json().catch(() => null)));
});
