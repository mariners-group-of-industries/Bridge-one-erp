import { createCollection, listCollections } from "@/features/sales/collections/services/collection.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET /api/sales/collections?kind=INVOICE|ADVANCE[&officeId&customerId&salesPersonId&from&to&cancelled=true] */
export const GET = apiHandler("sales:read", async (request, _context, actor) =>
  ok(await listCollections(actor, Object.fromEntries(new URL(request.url).searchParams))),
);

/** POST body: an INVOICE collection (with allocations) or an ADVANCE. */
export const POST = apiHandler("sales:write", async (request, _context, actor) =>
  ok(await createCollection(actor, await request.json().catch(() => null)), 201),
);
