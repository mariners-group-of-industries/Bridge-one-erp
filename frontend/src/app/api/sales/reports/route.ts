import { getReport } from "@/features/sales/reports/services/report.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET /api/sales/reports?report=<key>&asOf=YYYY-MM-DD[&filters]: one Sales Report (see REPORTS). */
export const GET = apiHandler("sales:read", async (request, _context, actor) => ok(await getReport(actor, Object.fromEntries(new URL(request.url).searchParams))));
