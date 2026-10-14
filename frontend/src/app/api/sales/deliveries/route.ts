import { createDelivery, listDeliveries } from "@/features/sales/deliveries/services/delivery.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET /api/sales/deliveries[?officeId&deliveryType&confirmation&…&deleted=true] */
export const GET = apiHandler("sales:read", async (request, _context, actor) =>
  ok(await listDeliveries(actor, Object.fromEntries(new URL(request.url).searchParams))),
);

/** POST body: a SALES_ORDER, DIRECT or EXCHANGE delivery. */
export const POST = apiHandler("sales:write", async (request, _context, actor) =>
  ok(await createDelivery(actor, await request.json().catch(() => null)), 201),
);
