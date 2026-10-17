import { pipelineInputSchema } from "@/features/configuration/security/approval/schemas/approval.schema";
import { deletePipeline, getPipeline, updatePipeline } from "@/features/configuration/security/approval/server/approval.service";
import { apiHandler, noContent, ok, parseId, parseJson } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };
const idOf = async (context: Context) => parseId((await context.params).id, "Approval pipeline");

export const GET = apiHandler("configuration:read", async (_request, context: Context, actor) => ok(await getPipeline(actor, await idOf(context))));

export const PUT = apiHandler("configuration:write", async (request, context: Context, actor) => ok(await updatePipeline(actor, await idOf(context), await parseJson(request, pipelineInputSchema))));

export const DELETE = apiHandler("configuration:write", async (_request, context: Context, actor) => {
  await deletePipeline(actor, await idOf(context));
  return noContent();
});
