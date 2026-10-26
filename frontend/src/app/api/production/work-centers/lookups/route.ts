import { workCenterLookups } from "@/features/production/work-centers/services/work-center.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET: types, departments, sections, warehouses and employees for the work center pages. */
export const GET = apiHandler("production:read", async (_request, _context, actor) => ok(await workCenterLookups(actor)));
