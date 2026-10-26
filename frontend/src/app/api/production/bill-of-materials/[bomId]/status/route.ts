import { setBomActive } from "@/features/production/bom/services/bom.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ bomId: string }> };

/** PUT body: { version, isActive }. */
export const PUT = apiHandler<Context>("production:write", async (request, context, actor) =>
  ok(await setBomActive(actor, parseId((await context.params).bomId, "Bill of material"), await request.json().catch(() => null))),
);
