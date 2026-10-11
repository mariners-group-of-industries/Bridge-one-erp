import { updateTermSchema } from "@/features/configuration/business-config/company-profile/schemas/terms.schema";
import {
  deleteTerm,
  updateTerm,
} from "@/features/configuration/business-config/company-profile/server/terms.service";
import { apiHandler, noContent, ok, parseId, parseJson } from "@/lib/api/handler";

type Context = RouteContext<"/api/configuration/terms/[termId]">;

/** Partial update: content, default flag and/or applicable document types. */
export const PATCH = apiHandler("configuration:write", async (request, context: Context, actor) => {
  const id = parseId((await context.params).termId, "Terms & conditions entry");
  const patch = await parseJson(request, updateTermSchema);
  return ok(await updateTerm(actor, id, patch));
});

export const DELETE = apiHandler("configuration:write", async (_request, context: Context, actor) => {
  const id = parseId((await context.params).termId, "Terms & conditions entry");
  await deleteTerm(actor, id);
  return noContent();
});
