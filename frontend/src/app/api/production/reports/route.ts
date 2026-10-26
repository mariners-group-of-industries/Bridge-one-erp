import { getReport } from "@/features/production/reports/services/report.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET ?viewBy&from&to&<filters>: one production report (columns, rows, totals). */
export const GET = apiHandler("production:read", async (request, _context, actor) =>
  ok(await getReport(actor, Object.fromEntries(new URL(request.url).searchParams))),
);
