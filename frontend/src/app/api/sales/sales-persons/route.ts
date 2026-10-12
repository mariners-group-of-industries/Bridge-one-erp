import { businessUnitQuerySchema } from "@/features/sales/masters/schemas/masters.schema";
import { listSalesPersons, createSalesPerson } from "@/features/sales/masters/services/masters.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET /api/sales/sales-persons?businessUnitId=uuid[&includeInactive=true] */
export const GET = apiHandler("sales:read", async (request, _context, actor) => {
  const query = businessUnitQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return ok(await listSalesPersons(actor, query.businessUnitId, query.includeInactive));
});

export const POST = apiHandler("sales:write", async (request, _context, actor) =>
  ok(await createSalesPerson(actor, await request.json().catch(() => null)), 201),
);
