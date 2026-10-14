import { createReturn, listReturns } from "@/features/sales/returns/services/return.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET /api/sales/returns[?kind&mode&status&officeId&customerGroupId&territoryId&salesPersonId&from&to] */
export const GET = apiHandler("sales:read", async (request, _context, actor) =>
  ok(await listReturns(actor, Object.fromEntries(new URL(request.url).searchParams))),
);

/** POST body: a FULL / PARTIAL return of a delivery, or a WITHOUT_REFERENCE return. Saved as pending. */
export const POST = apiHandler("sales:write", async (request, _context, actor) =>
  ok(await createReturn(actor, await request.json().catch(() => null)), 201),
);
