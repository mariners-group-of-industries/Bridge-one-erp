import { permissionGroupInputSchema } from "@/features/configuration/security/groups/schemas/groups.schema";
import { deletePermissionGroup, getPermissionGroup, savePermissionGroup } from "@/features/configuration/security/groups/server/groups.service";
import { apiHandler, noContent, ok, parseId, parseJson } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };
const idOf = async (context: Context) => parseId((await context.params).id, "Permission group");

export const GET = apiHandler("configuration:read", async (_request, context: Context, actor) => ok(await getPermissionGroup(actor, await idOf(context))));

export const PUT = apiHandler("configuration:write", async (request, context: Context, actor) =>
  ok(await savePermissionGroup(actor, await parseJson(request, permissionGroupInputSchema), await idOf(context))),
);

export const DELETE = apiHandler("configuration:write", async (_request, context: Context, actor) => {
  await deletePermissionGroup(actor, await idOf(context));
  return noContent();
});
