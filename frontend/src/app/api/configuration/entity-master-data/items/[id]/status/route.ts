import { z } from "zod";
import { setItemActive } from "@/features/configuration/entity-master-data/item/server/item.service";
import { apiHandler, ok, parseId, parseJson } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

/** Active/Inactive toggle from the item list. */
export const PATCH = apiHandler("configuration:write", async (request, context: Context, actor) => {
  const id = parseId((await context.params).id, "Item");
  const { isActive } = await parseJson(request, z.object({ isActive: z.boolean() }));
  return ok(await setItemActive(actor, id, isActive));
});
