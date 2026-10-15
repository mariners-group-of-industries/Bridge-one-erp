import { nodeUpdateSchema } from "@/features/configuration/sales-config/territory/schemas/territory.schema";
import { deleteNode, updateNode } from "@/features/configuration/sales-config/territory/server/territory.service";
import { apiHandler, noContent, ok, parseId, parseJson } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

/** "Update Territory": code and name. */
export const PUT = apiHandler("configuration:write", async (request, context: Context, actor) => {
  const id = parseId((await context.params).id, "Territory");
  return ok(await updateNode(actor, id, await parseJson(request, nodeUpdateSchema)));
});

export const DELETE = apiHandler("configuration:write", async (_request, context: Context, actor) => {
  await deleteNode(actor, parseId((await context.params).id, "Territory"));
  return noContent();
});
