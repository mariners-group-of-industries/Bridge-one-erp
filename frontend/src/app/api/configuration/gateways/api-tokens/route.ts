import { generateTokenSchema } from "@/features/configuration/gateways/schemas/api-token.schema";
import { createApiToken, listApiTokens } from "@/features/configuration/gateways/server/api-token.service";
import { apiHandler, ok, parseJson } from "@/lib/api/handler";

export const GET = apiHandler("configuration:read", async (_request, _context, actor) => ok(await listApiTokens(actor)));

/** Generates a token. The response holds the full token; it is never shown again. */
export const POST = apiHandler("configuration:write", async (request, _context, actor) => ok(await createApiToken(actor, await parseJson(request, generateTokenSchema)), 201));
