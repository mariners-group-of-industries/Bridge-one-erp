import { createVehicle, listVehicles } from "@/features/sales/deliveries/services/vehicle.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET /api/sales/vehicles[?businessUnitId]: active vehicles with compartments. */
export const GET = apiHandler("sales:read", async (request, _context, actor) =>
  ok(await listVehicles(actor, new URL(request.url).searchParams.get("businessUnitId") ?? undefined)),
);

/** POST: Vehicle Create. */
export const POST = apiHandler("sales:write", async (request, _context, actor) =>
  ok(await createVehicle(actor, await request.json().catch(() => null)), 201),
);
