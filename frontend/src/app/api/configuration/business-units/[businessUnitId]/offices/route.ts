import { officeInputSchema } from "@/features/configuration/business-config/company-profile/schemas/office.schema";
import {
  createOffice,
  listOffices,
} from "@/features/configuration/business-config/company-profile/server/office.service";
import { apiHandler, ok, parseId, parseJson } from "@/lib/api/handler";

type Context = RouteContext<"/api/configuration/business-units/[businessUnitId]/offices">;

export const GET = apiHandler("configuration:read", async (_request, context: Context, actor) => {
  const businessUnitId = parseId((await context.params).businessUnitId, "Business unit");
  return ok(await listOffices(actor, businessUnitId));
});

export const POST = apiHandler("configuration:write", async (request, context: Context, actor) => {
  const businessUnitId = parseId((await context.params).businessUnitId, "Business unit");
  const input = await parseJson(request, officeInputSchema);
  return ok(await createOffice(actor, businessUnitId, input), 201);
});
