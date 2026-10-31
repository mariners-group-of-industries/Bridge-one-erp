import { createProcess } from "@/features/production/entries/services/wastage.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** POST body: { businessUnitId?, name }. "ADD NEW" production process. */
export const POST = apiHandler("production:write", async (request, _context, actor) => ok(await createProcess(actor, await request.json().catch(() => null)), 201));
