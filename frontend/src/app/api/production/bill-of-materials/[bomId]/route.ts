import { deleteBom, getBom, updateBom } from "@/features/production/bom/services/bom.service";
import { apiHandler, noContent, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ bomId: string }> };
const idOf = async (context: Context) => parseId((await context.params).bomId, "Bill of material");

export const GET = apiHandler<Context>("production:read", async (_request, context, actor) => ok(await getBom(actor, await idOf(context))));

/** PUT body: { version, data }. */
export const PUT = apiHandler<Context>("production:write", async (request, context, actor) =>
  ok(await updateBom(actor, await idOf(context), await request.json().catch(() => null))),
);

/** DELETE body: { version }. Refused while another BOM uses this one as a child. */
export const DELETE = apiHandler<Context>("production:write", async (request, context, actor) => {
  await deleteBom(actor, await idOf(context), await request.json().catch(() => null));
  return noContent();
});
