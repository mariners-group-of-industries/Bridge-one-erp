import { getWorkCenter, updateWorkCenter } from "@/features/production/work-centers/services/work-center.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ workCenterId: string }> };
const idOf = async (context: Context) => parseId((await context.params).workCenterId, "Work center");

export const GET = apiHandler<Context>("production:read", async (_request, context, actor) => ok(await getWorkCenter(actor, await idOf(context))));

/** PUT body: { version, data }. */
export const PUT = apiHandler<Context>("production:write", async (request, context, actor) =>
  ok(await updateWorkCenter(actor, await idOf(context), await request.json().catch(() => null))),
);
