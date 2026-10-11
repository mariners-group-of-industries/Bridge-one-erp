import {
  createTermSchema,
  termsDomainSchema,
} from "@/features/configuration/business-config/company-profile/schemas/terms.schema";
import {
  createTerm,
  listTerms,
} from "@/features/configuration/business-config/company-profile/server/terms.service";
import { apiHandler, ok, parseId, parseJson } from "@/lib/api/handler";

type Context = { params: Promise<{ businessUnitId: string }> };

/** GET ?domain=SALES|PURCHASE */
export const GET = apiHandler("configuration:read", async (request, context: Context, actor) => {
  const businessUnitId = parseId((await context.params).businessUnitId, "Business unit");
  const domain = termsDomainSchema.parse(new URL(request.url).searchParams.get("domain"));
  return ok(await listTerms(actor, businessUnitId, domain));
});

export const POST = apiHandler("configuration:write", async (request, context: Context, actor) => {
  const businessUnitId = parseId((await context.params).businessUnitId, "Business unit");
  const input = await parseJson(request, createTermSchema);
  return ok(await createTerm(actor, businessUnitId, input), 201);
});
