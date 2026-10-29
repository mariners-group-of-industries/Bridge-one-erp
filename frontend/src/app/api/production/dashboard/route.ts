import { getProductionDashboard } from "@/features/production/dashboard/services/dashboard.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET /api/production/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD[&officeId=uuid] */
export const GET = apiHandler("production:read", async (request, _context, actor) =>
  ok(await getProductionDashboard(actor, Object.fromEntries(new URL(request.url).searchParams))),
);
