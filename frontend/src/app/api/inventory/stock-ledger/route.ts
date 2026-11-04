import { stockLedger } from "@/features/inventory/server/overview.service";
import { apiHandler, ok } from "@/lib/api/handler";
import { badRequest } from "@/lib/api/errors";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** GET ?from&to[&warehouseId][&category][&itemId]: stock ledger lines for the inventory reports. */
export const GET = apiHandler("purchase:read", async (request, _context, actor) => {
  const q = new URL(request.url).searchParams;
  const from = q.get("from") ?? "";
  const to = q.get("to") ?? "";
  if (!DATE.test(from) || !DATE.test(to) || from > to) throw badRequest("Choose a valid date range.");
  return ok(
    await stockLedger(actor, {
      from,
      to,
      warehouseId: q.get("warehouseId") || undefined,
      category: q.get("category") || undefined,
      itemId: q.get("itemId") || undefined,
    }),
  );
});
