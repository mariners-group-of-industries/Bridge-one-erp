import { deleteOrder, getOrder, updateOrder } from "@/features/sales/orders/services/order.service";
import { apiHandler, noContent, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ orderId: string }> };

export const GET = apiHandler<Context>("sales:read", async (_request, context, actor) => {
  return ok(await getOrder(actor, parseId((await context.params).orderId, "Sales order")));
});

/** PUT body: { version: updatedAt, data: OrderInput }. Drafts only. */
export const PUT = apiHandler<Context>("sales:write", async (request, context, actor) => {
  const id = parseId((await context.params).orderId, "Sales order");
  return ok(await updateOrder(actor, id, await request.json().catch(() => null)));
});

export const DELETE = apiHandler<Context>("sales:write", async (_request, context, actor) => {
  await deleteOrder(actor, parseId((await context.params).orderId, "Sales order"));
  return noContent();
});
