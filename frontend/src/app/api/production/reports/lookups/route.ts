import { reportLookups } from "@/features/production/reports/services/report.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET: filter options of the production reports. */
export const GET = apiHandler("production:read", async (_request, _context, actor) => ok(await reportLookups(actor)));
