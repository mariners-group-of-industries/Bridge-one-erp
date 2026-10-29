import { searchOperators } from "@/features/production/work-centers/services/work-center.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET ?search=<3+ letters>[&businessUnitId]: active employees to tag as operators. */
export const GET = apiHandler("production:read", async (request, _context, actor) =>
  ok(await searchOperators(actor, Object.fromEntries(new URL(request.url).searchParams))),
);
