import { getTree } from "@/features/configuration/sales-config/territory/server/territory.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** Layers and nodes of a business unit (?businessUnitId, defaults to the first one). */
export const GET = apiHandler("configuration:read", async (request, _context, actor) => {
  const businessUnitId = new URL(request.url).searchParams.get("businessUnitId") ?? undefined;
  return ok(await getTree(actor, businessUnitId));
});
