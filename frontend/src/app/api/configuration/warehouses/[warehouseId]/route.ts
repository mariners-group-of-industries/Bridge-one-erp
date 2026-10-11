import { warehouseInputSchema } from "@/features/configuration/business-config/company-profile/schemas/office.schema";
import {
  deleteWarehouse,
  updateWarehouse,
} from "@/features/configuration/business-config/company-profile/server/warehouse.service";
import { apiHandler, noContent, ok, parseId, parseJson } from "@/lib/api/handler";

type Context = { params: Promise<{ warehouseId: string }> };

export const PUT = apiHandler("configuration:write", async (request, context: Context, actor) => {
  const id = parseId((await context.params).warehouseId, "Warehouse");
  const input = await parseJson(request, warehouseInputSchema);
  return ok(await updateWarehouse(actor, id, input));
});

export const DELETE = apiHandler("configuration:write", async (_request, context: Context, actor) => {
  const id = parseId((await context.params).warehouseId, "Warehouse");
  await deleteWarehouse(actor, id);
  return noContent();
});
