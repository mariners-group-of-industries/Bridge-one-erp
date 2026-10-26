import { itemListQuerySchema, type ItemInput } from "@/features/configuration/entity-master-data/item/schemas/item.schema";
import { createItem, listItems } from "@/features/configuration/entity-master-data/item/server/item.service";
import { badRequest } from "@/lib/api/errors";
import { apiHandler, ok } from "@/lib/api/handler";

export const GET = apiHandler("configuration:read", async (request, _context, actor) => {
  const query = itemListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return ok(await listItems(actor, query));
});

export const POST = apiHandler("configuration:write", async (request, _context, actor) => {
  const body = (await request.json().catch(() => {
    throw badRequest("Request body must be valid JSON.");
  })) as ItemInput;
  // The service validates the body with the shared schema.
  return ok(await createItem(actor, body), 201);
});
