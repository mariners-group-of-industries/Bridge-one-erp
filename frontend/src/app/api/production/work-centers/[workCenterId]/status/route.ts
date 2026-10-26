import { setWorkCenterActive } from "@/features/production/work-centers/services/work-center.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ workCenterId: string }> };

/** PUT body: { version, isActive }. */
export const PUT = apiHandler<Context>("production:write", async (request, context, actor) =>
  ok(await setWorkCenterActive(actor, parseId((await context.params).workCenterId, "Work center"), await request.json().catch(() => null))),
);
