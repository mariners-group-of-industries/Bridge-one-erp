import { createRoleSchema } from "@/features/configuration/entity-master-data/employee/schemas/personal-info.schema";
import { createRole, listRoles } from "@/features/configuration/entity-master-data/employee/server/personal-info.service";
import { apiHandler, ok, parseJson } from "@/lib/api/handler";

export const GET = apiHandler("employees:read", async () => ok(await listRoles()));

export const POST = apiHandler("employees:read", async (req, _ctx, actor) => {
  const input = await parseJson(req, createRoleSchema);
  return ok(await createRole(actor, input), 201);
});
