import { territoryCustomerGroups } from "@/features/configuration/sales-config/territory/server/territory.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** Territory Wise Customer List grouped by territory (?businessUnitId&nodeId&customerId&search). */
export const GET = apiHandler("configuration:read", async (request, _context, actor) =>
  ok(await territoryCustomerGroups(actor, Object.fromEntries(new URL(request.url).searchParams))),
);
