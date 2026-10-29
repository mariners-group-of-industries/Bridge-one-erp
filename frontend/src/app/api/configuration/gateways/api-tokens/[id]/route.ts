import { deleteApiToken } from "@/features/configuration/gateways/server/api-token.service";
import { apiHandler, noContent, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

export const DELETE = apiHandler("configuration:write", async (_request, context: Context, actor) => {
  await deleteApiToken(actor, parseId((await context.params).id, "API token"));
  return noContent();
});
