import { updateCounter } from "@/features/pos/server/pos.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

/** PATCH: edit a counter or switch it on / off. */
export const PATCH = apiHandler<{ params: Promise<{ id: string }> }>("sales:write", async (request, { params }, actor) =>
  ok(await updateCounter(actor, parseId((await params).id, "Counter"), await request.json().catch(() => ({})))),
);
