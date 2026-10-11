import { updateItem } from "@/features/sales/masters/services/masters.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

export const PUT = apiHandler<RouteContext<"/api/sales/items/[itemId]">>("sales:write", async (request, context, actor) => {
  const id = parseId((await context.params).itemId, "Item");
  return ok(await updateItem(actor, id, await request.json().catch(() => null)));
});
