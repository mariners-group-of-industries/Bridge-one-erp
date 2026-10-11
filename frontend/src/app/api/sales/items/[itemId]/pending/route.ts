import { getItemPendingQty } from "@/features/sales/masters/services/masters.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

/** GET /api/sales/items/:id/pending: quantity ordered but not yet delivered. */
export const GET = apiHandler<RouteContext<"/api/sales/items/[itemId]/pending">>("sales:read", async (_request, context, actor) => {
  const id = parseId((await context.params).itemId, "Item");
  return ok({ pendingQty: await getItemPendingQty(actor, id) });
});
