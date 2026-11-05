import { inventoryReport } from "@/features/inventory/server/overview.service";
import { apiHandler, ok } from "@/lib/api/handler";
import { badRequest } from "@/lib/api/errors";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** GET ?from&to[&warehouseId][&category]: opening, in, out and closing stock per warehouse and item. */
export const GET = apiHandler("purchase:read", async (request, _context, actor) => {
  const q = new URL(request.url).searchParams;
  const from = q.get("from") ?? "";
  const to = q.get("to") ?? "";
  if (!DATE.test(from) || !DATE.test(to) || from > to) throw badRequest("Choose a valid date range.");
  return ok(await inventoryReport(actor, { from, to, warehouseId: q.get("warehouseId") || undefined, category: q.get("category") || undefined }));
});
