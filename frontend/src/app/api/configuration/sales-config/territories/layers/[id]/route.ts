import { layerInputSchema } from "@/features/configuration/sales-config/territory/schemas/territory.schema";
import { deleteLayer, updateLayer } from "@/features/configuration/sales-config/territory/server/territory.service";
import { apiHandler, noContent, ok, parseId, parseJson } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

export const PUT = apiHandler("configuration:write", async (request, context: Context, actor) => {
  const id = parseId((await context.params).id, "Layer");
  return ok(await updateLayer(actor, id, await parseJson(request, layerInputSchema)));
});

export const DELETE = apiHandler("configuration:write", async (_request, context: Context, actor) => {
  await deleteLayer(actor, parseId((await context.params).id, "Layer"));
  return noContent();
});
