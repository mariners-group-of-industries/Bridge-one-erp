import { getSalesLookups } from "@/features/sales/masters/services/masters.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET /api/sales/lookups: offices and default terms for sales documents. */
export const GET = apiHandler("sales:read", async (_request, _context, actor) => ok(await getSalesLookups(actor)));
