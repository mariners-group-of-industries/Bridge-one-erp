import { warehouseInputSchema } from "@/features/configuration/business-config/company-profile/schemas/office.schema";
import {
  createWarehouse,
  listWarehouses,
} from "@/features/configuration/business-config/company-profile/server/warehouse.service";
import { apiHandler, ok, parseId, parseJson } from "@/lib/api/handler";

type Context = RouteContext<"/api/configuration/offices/[officeId]/warehouses">;

export const GET = apiHandler("configuration:read", async (_request, context: Context, actor) => {
  const officeId = parseId((await context.params).officeId, "Office");
  return ok(await listWarehouses(actor, officeId));
});

export const POST = apiHandler("configuration:write", async (request, context: Context, actor) => {
  const officeId = parseId((await context.params).officeId, "Office");
  const input = await parseJson(request, warehouseInputSchema);
  return ok(await createWarehouse(actor, officeId, input), 201);
});
