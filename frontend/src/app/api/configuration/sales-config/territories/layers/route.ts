import { z } from "zod";
import { addLayer } from "@/features/configuration/sales-config/territory/server/territory.service";
import { apiHandler, ok, parseJson } from "@/lib/api/handler";

export const POST = apiHandler("configuration:write", async (request, _context, actor) => {
  const { businessUnitId, ...input } = await parseJson(request, z.object({ businessUnitId: z.guid(), code: z.string(), name: z.string() }));
  return ok(await addLayer(actor, businessUnitId, input), 201);
});
