import { userAccessInputSchema } from "@/features/configuration/security/access/schemas/access.schema";
import { getUserAccess, updateUserAccess } from "@/features/configuration/security/access/server/access.service";
import { apiHandler, ok, parseId, parseJson } from "@/lib/api/handler";
import { clientOf } from "@/lib/audit/record";

type Context = { params: Promise<{ userId: string }> };
const idOf = async (context: Context) => parseId((await context.params).userId, "User");

/** ERP access, status, permission groups and individual overrides of one user. */
export const GET = apiHandler("configuration:read", async (_request, context: Context, actor) => ok(await getUserAccess(actor, await idOf(context))));

export const PATCH = apiHandler("configuration:write", async (request, context: Context, actor) =>
  ok(await updateUserAccess(actor, await idOf(context), await parseJson(request, userAccessInputSchema), clientOf(request))),
);
