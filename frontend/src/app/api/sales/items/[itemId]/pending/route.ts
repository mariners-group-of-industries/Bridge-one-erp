import { getItemPendingQty } from "@/features/sales/masters/services/masters.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

/** GET /api/sales/items/:id/pending: quantity ordered but not yet delivered. */
export const GET = apiHandler<{ params: Promise<{ itemId: string }> }>("sales:read", async (_request, context, actor) => {
  const id = parseId((await context.params).itemId, "Item");
  return ok({ pendingQty: await getItemPendingQty(actor, id) });
});
