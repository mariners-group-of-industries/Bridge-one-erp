import { searchDrivers } from "@/features/sales/deliveries/services/vehicle.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET /api/sales/drivers?businessUnitId&search: Driver (Employee) search (min 3 letters). */
export const GET = apiHandler("sales:read", async (request, _context, actor) => {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  if (!params.search && params.q) params.search = params.q;
  return ok(await searchDrivers(actor, params));
});
