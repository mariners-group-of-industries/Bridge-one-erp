import { qcMarketReturn } from "@/features/sales/returns/services/return.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

/** POST body: { version, lines: [{ lineId, qty }] }. Market return QC; passed goods go into stock. */
export const POST = apiHandler<{ params: Promise<{ returnId: string }> }>("sales:write", async (request, context, actor) => {
  const id = parseId((await context.params).returnId, "Sales return");
  return ok(await qcMarketReturn(actor, id, await request.json().catch(() => null)));
});
