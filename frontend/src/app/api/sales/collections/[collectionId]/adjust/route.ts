import { adjustAdvance } from "@/features/sales/collections/services/collection.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

/** POST body: { version, allocations }. Applies an advance to due invoices. */
export const POST = apiHandler<{ params: Promise<{ collectionId: string }> }>("sales:write", async (request, context, actor) =>
  ok(await adjustAdvance(actor, parseId((await context.params).collectionId, "Collection"), await request.json().catch(() => null))),
);
