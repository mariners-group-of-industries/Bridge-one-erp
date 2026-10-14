import { deleteReturn, getReturn, updateReturn } from "@/features/sales/returns/services/return.service";
import { apiHandler, noContent, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ returnId: string }> };
const idOf = async (context: Context) => parseId((await context.params).returnId, "Sales return");

export const GET = apiHandler<Context>("sales:read", async (_request, context, actor) => ok(await getReturn(actor, await idOf(context))));

/** PUT body: { version, data }. Only pending returns. */
export const PUT = apiHandler<Context>("sales:write", async (request, context, actor) =>
  ok(await updateReturn(actor, await idOf(context), await request.json().catch(() => null))),
);

/** DELETE body: { version, reason }. Soft delete; an approved return also leaves stock again. */
export const DELETE = apiHandler<Context>("sales:write", async (request, context, actor) => {
  await deleteReturn(actor, await idOf(context), await request.json().catch(() => null));
  return noContent();
});
