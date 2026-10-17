import { createCategorySchema } from "@/features/configuration/entity-master-data/item/schemas/item.schema";
import { createCategory } from "@/features/configuration/entity-master-data/item/server/item.service";
import { apiHandler, ok, parseJson } from "@/lib/api/handler";

/** New category (no parentId), sub category or minor category. */
export const POST = apiHandler("configuration:write", async (request, _context, actor) => {
  const input = await parseJson(request, createCategorySchema);
  return ok(await createCategory(actor, input), 201);
});
