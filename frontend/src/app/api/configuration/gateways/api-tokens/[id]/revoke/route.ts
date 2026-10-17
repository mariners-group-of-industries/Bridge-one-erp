import { revokeApiToken } from "@/features/configuration/gateways/server/api-token.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

/** Revokes a token immediately; it stops working on the next request. */
export const POST = apiHandler("configuration:write", async (_request, context: Context, actor) => ok(await revokeApiToken(actor, parseId((await context.params).id, "API token"))));
