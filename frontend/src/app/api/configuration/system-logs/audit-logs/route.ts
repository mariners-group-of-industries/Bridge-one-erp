import { listAuditLogs } from "@/features/configuration/system-logs/server/audit-log.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** ?feature, userId, actionType, from, to (YYYY-MM-DD), page, pageSize */
export const GET = apiHandler("configuration:read", async (request, _context, actor) => ok(await listAuditLogs(actor, Object.fromEntries(new URL(request.url).searchParams))));
