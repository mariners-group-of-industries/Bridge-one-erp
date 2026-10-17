import { userGroupInputSchema } from "@/features/configuration/security/groups/schemas/groups.schema";
import { listUserGroups, saveUserGroup } from "@/features/configuration/security/groups/server/groups.service";
import { apiHandler, ok, parseJson } from "@/lib/api/handler";

/** ?search, page, pageSize */
export const GET = apiHandler("configuration:read", async (request, _context, actor) => ok(await listUserGroups(actor, Object.fromEntries(new URL(request.url).searchParams))));

export const POST = apiHandler("configuration:write", async (request, _context, actor) => ok(await saveUserGroup(actor, await parseJson(request, userGroupInputSchema)), 201));
