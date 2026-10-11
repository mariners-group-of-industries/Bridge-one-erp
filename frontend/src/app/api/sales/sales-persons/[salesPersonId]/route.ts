import { updateSalesPerson } from "@/features/sales/masters/services/masters.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

export const PUT = apiHandler<RouteContext<"/api/sales/sales-persons/[salesPersonId]">>("sales:write", async (request, context, actor) => {
  const id = parseId((await context.params).salesPersonId, "Sales person");
  return ok(await updateSalesPerson(actor, id, await request.json().catch(() => null)));
});
