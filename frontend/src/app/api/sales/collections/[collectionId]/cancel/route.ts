import { cancelCollection } from "@/features/sales/collections/services/collection.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

/** POST body: { version, reason }. Its invoices become due again. */
export const POST = apiHandler<{ params: Promise<{ collectionId: string }> }>("sales:write", async (request, context, actor) =>
  ok(await cancelCollection(actor, parseId((await context.params).collectionId, "Collection"), await request.json().catch(() => null))),
);
