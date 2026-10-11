import { officeInputSchema } from "@/features/configuration/business-config/company-profile/schemas/office.schema";
import {
  deleteOffice,
  getOffice,
  updateOffice,
} from "@/features/configuration/business-config/company-profile/server/office.service";
import { apiHandler, noContent, ok, parseId, parseJson } from "@/lib/api/handler";

type Context = { params: Promise<{ officeId: string }> };

export const GET = apiHandler("configuration:read", async (_request, context: Context, actor) => {
  const id = parseId((await context.params).officeId, "Office");
  return ok(await getOffice(actor, id));
});

export const PUT = apiHandler("configuration:write", async (request, context: Context, actor) => {
  const id = parseId((await context.params).officeId, "Office");
  const input = await parseJson(request, officeInputSchema);
  return ok(await updateOffice(actor, id, input));
});

export const DELETE = apiHandler("configuration:write", async (_request, context: Context, actor) => {
  const id = parseId((await context.params).officeId, "Office");
  await deleteOffice(actor, id);
  return noContent();
});
