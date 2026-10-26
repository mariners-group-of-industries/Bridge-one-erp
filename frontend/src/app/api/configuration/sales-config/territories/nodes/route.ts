import { nodeInputSchema } from "@/features/configuration/sales-config/territory/schemas/territory.schema";
import { createNode } from "@/features/configuration/sales-config/territory/server/territory.service";
import { apiHandler, ok, parseJson } from "@/lib/api/handler";

/** Add a node under parentId (or a top-layer node when parentId is empty). */
export const POST = apiHandler("configuration:write", async (request, _context, actor) => {
  return ok(await createNode(actor, await parseJson(request, nodeInputSchema)), 201);
});
