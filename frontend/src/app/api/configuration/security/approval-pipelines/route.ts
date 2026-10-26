import { pipelineInputSchema } from "@/features/configuration/security/approval/schemas/approval.schema";
import { createPipeline, listPipelines } from "@/features/configuration/security/approval/server/approval.service";
import { apiHandler, ok, parseJson } from "@/lib/api/handler";

/** ?search, page, pageSize */
export const GET = apiHandler("configuration:read", async (request, _context, actor) => ok(await listPipelines(actor, Object.fromEntries(new URL(request.url).searchParams))));

export const POST = apiHandler("configuration:write", async (request, _context, actor) => ok(await createPipeline(actor, await parseJson(request, pipelineInputSchema)), 201));
