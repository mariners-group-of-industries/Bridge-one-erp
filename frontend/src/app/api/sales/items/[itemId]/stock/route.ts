import { getItemStock } from "@/features/sales/deliveries/services/stock.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

/** GET /api/sales/items/:id/stock: stock per warehouse and recent movements. */
export const GET = apiHandler<{ params: Promise<{ itemId: string }> }>("sales:read", async (_request, context, actor) =>
  ok(await getItemStock(actor, parseId((await context.params).itemId, "Item"))),
);
