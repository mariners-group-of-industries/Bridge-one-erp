import { addPendingNote, listPendingNotes, setOrderPendingReason } from "@/features/sales/deliveries/services/delivery.service";
import { apiHandler, noContent, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ orderId: string }> };
const orderId = async (context: Context) => parseId((await context.params).orderId, "Sales order");

/** GET: Previous Pending Reason (newest last). */
export const GET = apiHandler<Context>("sales:read", async (_request, context, actor) => ok(await listPendingNotes(actor, await orderId(context))));

/** POST body: { reason } — records a new pending reason and makes it the order's current one. */
export const POST = apiHandler<Context>("sales:write", async (request, context, actor) =>
  ok(await addPendingNote(actor, await orderId(context), await request.json().catch(() => null)), 201),
);

/** PUT body: { reasonId | null } */
export const PUT = apiHandler<Context>("sales:write", async (request, context, actor) => {
  await setOrderPendingReason(actor, await orderId(context), await request.json().catch(() => null));
  return noContent();
});
