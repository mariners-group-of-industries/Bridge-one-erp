import { getOrder, updateOrder } from "@/features/production/orders/services/order.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ orderId: string }> };
const idOf = async (context: Context) => parseId((await context.params).orderId, "Production order");

export const GET = apiHandler<Context>("production:read", async (_request, context, actor) => ok(await getOrder(actor, await idOf(context))));

/** PUT body: { version, data }. Only orders nobody has approved yet. */
export const PUT = apiHandler<Context>("production:write", async (request, context, actor) =>
  ok(await updateOrder(actor, await idOf(context), await request.json().catch(() => null))),
);
