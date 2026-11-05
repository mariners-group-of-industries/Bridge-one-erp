import { effectivePermissions } from "@/features/configuration/security/access/server/access.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

/** Every permission of the user, resolved, with where it comes from (group, Allow, Deny). */
export const GET = apiHandler("configuration:read", async (_request, context: { params: Promise<{ userId: string }> }, actor) =>
  ok(await effectivePermissions(actor, parseId((await context.params).userId, "User"))),
);
