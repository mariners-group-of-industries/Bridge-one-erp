import { posReports } from "@/features/pos/server/pos-reports.service";
import { apiHandler, ok } from "@/lib/api/handler";
import { badRequest } from "@/lib/api/errors";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** GET ?from&to: every POS report tab for the period. */
export const GET = apiHandler("sales:read", async (request, _context, actor) => {
  const q = new URL(request.url).searchParams;
  const from = q.get("from") ?? "";
  const to = q.get("to") ?? "";
  if (!DATE.test(from) || !DATE.test(to) || from > to) throw badRequest("Choose a valid date range.");
  return ok(await posReports(actor, { from, to }));
});
