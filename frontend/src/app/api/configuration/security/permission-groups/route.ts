import { permissionGroupInputSchema } from "@/features/configuration/security/access/schemas/access.schema";
import { listPermissionGroups, savePermissionGroup } from "@/features/configuration/security/access/server/access.service";
import { apiHandler, ok, parseJson } from "@/lib/api/handler";
import { clientOf } from "@/lib/audit/record";

/** ?search, status, page, pageSize */
export const GET = apiHandler("configuration:read", async (request, _context, actor) => ok(await listPermissionGroups(actor, Object.fromEntries(new URL(request.url).searchParams))));

export const POST = apiHandler("configuration:write", async (request, _context, actor) =>
  ok(await savePermissionGroup(actor, await parseJson(request, permissionGroupInputSchema), undefined, clientOf(request)), 201),
);
