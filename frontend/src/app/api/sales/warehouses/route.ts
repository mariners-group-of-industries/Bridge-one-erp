import { listWarehouses } from "@/features/sales/deliveries/services/stock.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET /api/sales/warehouses: warehouses of every office in scope. */
export const GET = apiHandler("sales:read", async (_request, _context, actor) => ok(await listWarehouses(actor)));
