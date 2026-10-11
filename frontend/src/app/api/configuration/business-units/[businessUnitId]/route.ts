import { businessUnitInputSchema } from "@/features/configuration/business-config/company-profile/schemas/business-unit.schema";
import {
  deleteBusinessUnit,
  updateBusinessUnit,
} from "@/features/configuration/business-config/company-profile/server/business-unit.service";
import { apiHandler, noContent, ok, parseId, parseJson } from "@/lib/api/handler";

type Context = RouteContext<"/api/configuration/business-units/[businessUnitId]">;

export const PUT = apiHandler("configuration:write", async (request, context: Context, actor) => {
  const id = parseId((await context.params).businessUnitId, "Business unit");
  const input = await parseJson(request, businessUnitInputSchema);
  return ok(await updateBusinessUnit(actor, id, input));
});

export const DELETE = apiHandler("configuration:write", async (_request, context: Context, actor) => {
  const id = parseId((await context.params).businessUnitId, "Business unit");
  await deleteBusinessUnit(actor, id);
  return noContent();
});
