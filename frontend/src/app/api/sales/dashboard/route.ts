import { dashboardQuerySchema } from "@/features/sales/dashboard/schemas/dashboard.schema";
import { getSalesDashboard } from "@/features/sales/dashboard/services/dashboard.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET /api/sales/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD[&businessUnitId=uuid] */
export const GET = apiHandler("sales:read", async (request, _context, actor) => {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  return ok(await getSalesDashboard(actor, dashboardQuerySchema.parse(params)));
});
