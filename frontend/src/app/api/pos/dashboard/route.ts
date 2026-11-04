import { posDashboard } from "@/features/pos/server/pos-reports.service";
import { apiHandler, ok } from "@/lib/api/handler";
import { badRequest } from "@/lib/api/errors";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** GET ?from&to&year: the POS dashboard from counter sales. */
export const GET = apiHandler("sales:read", async (request, _context, actor) => {
  const q = new URL(request.url).searchParams;
  const from = q.get("from") ?? "";
  const to = q.get("to") ?? "";
  const year = Number(q.get("year") ?? new Date().getFullYear());
  if (!DATE.test(from) || !DATE.test(to) || from > to || !Number.isInteger(year)) throw badRequest("Choose a valid date range.");
  return ok(await posDashboard(actor, { from, to, year }));
});
