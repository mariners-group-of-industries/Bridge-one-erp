import { receiveMarketReturn } from "@/features/sales/returns/services/return.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

/** POST body: { version, lines: [{ lineId, qty }] }. Market return reached the factory. */
export const POST = apiHandler<{ params: Promise<{ returnId: string }> }>("sales:write", async (request, context, actor) => {
  const id = parseId((await context.params).returnId, "Sales return");
  return ok(await receiveMarketReturn(actor, id, await request.json().catch(() => null)));
});
