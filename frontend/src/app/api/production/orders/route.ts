import { createOrder, listOrders } from "@/features/production/orders/services/order.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET /api/production/orders[?from&to&status&bomId&search] */
export const GET = apiHandler("production:read", async (request, _context, actor) =>
  ok(await listOrders(actor, Object.fromEntries(new URL(request.url).searchParams))),
);

/** POST body: the order; materials are exploded from the BOM and approval stages copied from the pipeline. */
export const POST = apiHandler("production:write", async (request, _context, actor) =>
  ok(await createOrder(actor, await request.json().catch(() => null)), 201),
);
