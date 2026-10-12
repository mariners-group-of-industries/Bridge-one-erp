import { businessUnitQuerySchema } from "@/features/sales/masters/schemas/masters.schema";
import { listItems, createItem } from "@/features/sales/masters/services/masters.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET /api/sales/items?businessUnitId=uuid[&includeInactive=true] */
export const GET = apiHandler("sales:read", async (request, _context, actor) => {
  const query = businessUnitQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return ok(await listItems(actor, query.businessUnitId, query.includeInactive));
});

export const POST = apiHandler("sales:write", async (request, _context, actor) =>
  ok(await createItem(actor, await request.json().catch(() => null)), 201),
);
