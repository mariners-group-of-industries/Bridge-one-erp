import { userOptions } from "@/features/configuration/security/groups/server/groups.service";
import { apiHandler, ok } from "@/lib/api/handler";

export const GET = apiHandler("configuration:read", async (_request, _context, actor) => ok(await userOptions(actor)));
