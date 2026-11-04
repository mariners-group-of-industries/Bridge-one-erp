import { stockOnHand } from "@/features/inventory/server/overview.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET [?warehouseId]: stock on hand per warehouse and item, for the inventory forms. */
export const GET = apiHandler("purchase:read", async (request, _context, actor) =>
  ok(await stockOnHand(actor, new URL(request.url).searchParams.get("warehouseId") || undefined)),
);
