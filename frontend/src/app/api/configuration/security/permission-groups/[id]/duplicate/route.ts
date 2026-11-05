import { duplicatePermissionGroup } from "@/features/configuration/security/access/server/access.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";
import { clientOf } from "@/lib/audit/record";

type Context = { params: Promise<{ id: string }> };

/** Copies the group's permissions into a new, inactive group without users. */
export const POST = apiHandler("configuration:write", async (request, context: Context, actor) =>
  ok(await duplicatePermissionGroup(actor, parseId((await context.params).id, "Permission group"), clientOf(request)), 201),
);
