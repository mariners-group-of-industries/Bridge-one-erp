import { getCollection } from "@/features/sales/collections/services/collection.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

export const GET = apiHandler<{ params: Promise<{ collectionId: string }> }>("sales:read", async (_request, context, actor) =>
  ok(await getCollection(actor, parseId((await context.params).collectionId, "Collection"))),
);
