import type { ItemInput } from "@/features/configuration/entity-master-data/item/schemas/item.schema";
import { getItem, updateItem } from "@/features/configuration/entity-master-data/item/server/item.service";
import { badRequest } from "@/lib/api/errors";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

export const GET = apiHandler("configuration:read", async (_request, context: Context, actor) => {
  const id = parseId((await context.params).id, "Item");
  return ok(await getItem(actor, id));
});

export const PUT = apiHandler("configuration:write", async (request, context: Context, actor) => {
  const id = parseId((await context.params).id, "Item");
  const body = (await request.json().catch(() => {
    throw badRequest("Request body must be valid JSON.");
  })) as ItemInput;
  return ok(await updateItem(actor, id, body));
});
