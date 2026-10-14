import { updateCategorySchema } from "@/features/configuration/entity-master-data/item/schemas/item.schema";
import { deleteCategory, updateCategory } from "@/features/configuration/entity-master-data/item/server/item.service";
import { apiHandler, noContent, ok, parseId, parseJson } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

export const PUT = apiHandler("configuration:write", async (request, context: Context, actor) => {
  const id = parseId((await context.params).id, "Category");
  const input = await parseJson(request, updateCategorySchema);
  return ok(await updateCategory(actor, id, input));
});

export const DELETE = apiHandler("configuration:write", async (_request, context: Context, actor) => {
  const id = parseId((await context.params).id, "Category");
  await deleteCategory(actor, id);
  return noContent();
});
