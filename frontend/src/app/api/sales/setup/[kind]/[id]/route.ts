import { z } from "zod";
import { SETUP_KINDS } from "@/features/sales/masters/schemas/masters.schema";
import { deleteSetupRecord, updateSetupRecord } from "@/features/sales/masters/services/masters.service";
import { notFound } from "@/lib/api/errors";
import { apiHandler, noContent, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ kind: string; id: string }> };
const kindSchema = z.enum(SETUP_KINDS);

async function target(context: Context) {
  const params = await context.params;
  const kind = kindSchema.safeParse(params.kind);
  if (!kind.success) throw notFound("Setup list");
  return { kind: kind.data, id: parseId(params.id, "Record") };
}

export const PUT = apiHandler<Context>("sales:write", async (request, context, actor) => {
  const { kind, id } = await target(context);
  await updateSetupRecord(actor, kind, id, await request.json().catch(() => null));
  return noContent();
});

export const DELETE = apiHandler<Context>("sales:write", async (_request, context, actor) => {
  const { kind, id } = await target(context);
  await deleteSetupRecord(actor, kind, id);
  return noContent();
});
