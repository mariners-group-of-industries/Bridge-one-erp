import { voidSale } from "@/features/pos/server/pos.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

/** POST { reason }: void a sale; its items go back into the counter's warehouse. */
export const POST = apiHandler<{ params: Promise<{ id: string }> }>("sales:write", async (request, { params }, actor) =>
  ok(await voidSale(actor, parseId((await params).id, "Sale"), await request.json().catch(() => ({})))),
);
