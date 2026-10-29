import { cancelEntry } from "@/features/production/entries/services/entry.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ entryId: string }> };

/** POST body: { version, reason }. Reverses the stock movements and the order's quantities. */
export const POST = apiHandler<Context>("production:write", async (request, context, actor) =>
  ok(await cancelEntry(actor, parseId((await context.params).entryId, "Production entry"), await request.json().catch(() => null))),
);
