import { optionalBusinessUnitQuerySchema } from "@/features/sales/masters/schemas/masters.schema";
import { getSetupLookups } from "@/features/sales/masters/services/masters.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET /api/sales/setup[?businessUnitId=uuid]: groups, areas, categories, price types, sales force. */
export const GET = apiHandler("sales:read", async (request, _context, actor) => {
  const { businessUnitId } = optionalBusinessUnitQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return ok(await getSetupLookups(actor, businessUnitId));
});
