import { userGroupInputSchema } from "@/features/configuration/security/groups/schemas/groups.schema";
import { deleteUserGroup, getUserGroup, saveUserGroup } from "@/features/configuration/security/groups/server/groups.service";
import { apiHandler, noContent, ok, parseId, parseJson } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };
const idOf = async (context: Context) => parseId((await context.params).id, "User group");

export const GET = apiHandler("configuration:read", async (_request, context: Context, actor) => ok(await getUserGroup(actor, await idOf(context))));

export const PUT = apiHandler("configuration:write", async (request, context: Context, actor) => ok(await saveUserGroup(actor, await parseJson(request, userGroupInputSchema), await idOf(context))));

export const DELETE = apiHandler("configuration:write", async (_request, context: Context, actor) => {
  await deleteUserGroup(actor, await idOf(context));
  return noContent();
});
