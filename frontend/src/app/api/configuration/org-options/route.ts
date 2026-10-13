import { getOrgOptions } from "@/features/configuration/entity-master-data/employee/server/personal-info.service";
import { apiHandler, ok } from "@/lib/api/handler";

export const GET = apiHandler("configuration:read", async (_req, _ctx, actor) =>
  ok(await getOrgOptions(actor)),
);
