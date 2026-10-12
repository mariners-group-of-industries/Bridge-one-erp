import { orderListQuerySchema } from "@/features/sales/orders/schemas/order.schema";
import { createOrder, listOrders } from "@/features/sales/orders/services/order.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET /api/sales/orders[?officeId&territoryId&…&from&to] */
export const GET = apiHandler("sales:read", async (request, _context, actor) => {
  const query = orderListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return ok(await listOrders(actor, query));
});

export const POST = apiHandler("sales:write", async (request, _context, actor) =>
  ok(await createOrder(actor, await request.json().catch(() => null)), 201),
);
