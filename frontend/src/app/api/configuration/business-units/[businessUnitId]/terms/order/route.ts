import { reorderTermsSchema } from "@/features/configuration/business-config/company-profile/schemas/terms.schema";
import { reorderTerms } from "@/features/configuration/business-config/company-profile/server/terms.service";
import { apiHandler, ok, parseId, parseJson } from "@/lib/api/handler";

type Context = RouteContext<"/api/configuration/business-units/[businessUnitId]/terms/order">;

export const PUT = apiHandler("configuration:write", async (request, context: Context, actor) => {
  const businessUnitId = parseId((await context.params).businessUnitId, "Business unit");
  const input = await parseJson(request, reorderTermsSchema);
  return ok(await reorderTerms(actor, businessUnitId, input));
});
