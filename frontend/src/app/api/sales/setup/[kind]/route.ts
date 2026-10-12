import { z } from "zod";
import { SETUP_KINDS } from "@/features/sales/masters/schemas/masters.schema";
import { createSetupRecord } from "@/features/sales/masters/services/masters.service";
import { notFound } from "@/lib/api/errors";
import { apiHandler, ok } from "@/lib/api/handler";

const kindSchema = z.enum(SETUP_KINDS);

/** POST /api/sales/setup/{customer-groups|areas|categories|price-lists} */
export const POST = apiHandler<{ params: Promise<{ kind: string }> }>("sales:write", async (request, context, actor) => {
  const kind = kindSchema.safeParse((await context.params).kind);
  if (!kind.success) throw notFound("Setup list");
  return ok(await createSetupRecord(actor, kind.data, await request.json().catch(() => null)), 201);
});
