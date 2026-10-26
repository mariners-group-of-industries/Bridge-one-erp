import { bomLookups } from "@/features/production/bom/services/bom.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET: departments, sections, item categories and items (with average rate and stock) for the BOM pages. */
export const GET = apiHandler("production:read", async (_request, _context, actor) => ok(await bomLookups(actor)));
