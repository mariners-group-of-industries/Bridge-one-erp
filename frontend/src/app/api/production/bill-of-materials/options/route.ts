import { bomOptions } from "@/features/production/bom/services/bom.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET ?search=<3+ letters>&exclude=<bomId>: active BOMs for "Tag Child BOM". */
export const GET = apiHandler("production:read", async (request, _context, actor) =>
  ok(await bomOptions(actor, Object.fromEntries(new URL(request.url).searchParams))),
);
