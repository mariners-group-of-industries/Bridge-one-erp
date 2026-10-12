import { listApprovedOrders } from "@/features/sales/deliveries/services/delivery.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET /api/sales/deliveries/approved-orders: approved orders waiting for delivery. */
export const GET = apiHandler("sales:read", async (request, _context, actor) =>
  ok(await listApprovedOrders(actor, Object.fromEntries(new URL(request.url).searchParams))),
);
