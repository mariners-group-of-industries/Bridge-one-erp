import { groupUsersInputSchema } from "@/features/configuration/security/access/schemas/access.schema";
import { getGroupUsers, setGroupUsers } from "@/features/configuration/security/access/server/access.service";
import { apiHandler, ok, parseId, parseJson } from "@/lib/api/handler";
import { clientOf } from "@/lib/audit/record";

type Context = { params: Promise<{ id: string }> };
const idOf = async (context: Context) => parseId((await context.params).id, "Permission group");

/** The group's members and every user who can be added. */
export const GET = apiHandler("configuration:read", async (_request, context: Context, actor) => ok(await getGroupUsers(actor, await idOf(context))));

/** body: { userIds } — replaces the members. */
export const PUT = apiHandler("configuration:write", async (request, context: Context, actor) =>
  ok(await setGroupUsers(actor, await idOf(context), await parseJson(request, groupUsersInputSchema), clientOf(request))),
);
