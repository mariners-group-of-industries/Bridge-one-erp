import { permissionGroupInputSchema } from "@/features/configuration/security/groups/schemas/groups.schema";
import { listPermissionGroups, savePermissionGroup } from "@/features/configuration/security/groups/server/groups.service";
import { apiHandler, ok, parseJson } from "@/lib/api/handler";

/** ?search, page, pageSize */
export const GET = apiHandler("configuration:read", async (request, _context, actor) => ok(await listPermissionGroups(actor, Object.fromEntries(new URL(request.url).searchParams))));

export const POST = apiHandler("configuration:write", async (request, _context, actor) => ok(await savePermissionGroup(actor, await parseJson(request, permissionGroupInputSchema)), 201));
