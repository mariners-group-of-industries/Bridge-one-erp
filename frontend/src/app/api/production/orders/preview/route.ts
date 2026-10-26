import { previewOrder } from "@/features/production/orders/services/order.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET ?bomId&itemId&quantity[&warehouseId]: required materials (and stock) before saving. */
export const GET = apiHandler("production:read", async (request, _context, actor) =>
  ok(await previewOrder(actor, Object.fromEntries(new URL(request.url).searchParams))),
);
