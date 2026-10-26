import { MASTER_KINDS, type MasterKind } from "@/features/production/work-centers/schemas/work-center.schema";
import { createMaster } from "@/features/production/work-centers/services/work-center.service";
import { notFound } from "@/lib/api/errors";
import { apiHandler, ok } from "@/lib/api/handler";

type Context = { params: Promise<{ kind: string }> };

/** POST /api/production/work-centers/masters/types|departments|sections ("ADD NEW"). */
export const POST = apiHandler<Context>("production:write", async (request, context, actor) => {
  const { kind } = await context.params;
  if (!(MASTER_KINDS as readonly string[]).includes(kind)) throw notFound("Master");
  return ok(await createMaster(actor, kind as MasterKind, await request.json().catch(() => null)), 201);
});
