import { orderLookups } from "@/features/production/orders/services/order.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET: offices, warehouses, work centers, producible items with their BOMs. */
export const GET = apiHandler("production:read", async (_request, _context, actor) => ok(await orderLookups(actor)));
