import { auditLogOptions } from "@/features/configuration/system-logs/server/audit-log.service";
import { apiHandler, ok } from "@/lib/api/handler";

export const GET = apiHandler("configuration:read", async (_request, _context, actor) => ok(await auditLogOptions(actor)));
