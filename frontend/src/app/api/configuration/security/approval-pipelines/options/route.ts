import { getApprovalFormOptions } from "@/features/configuration/security/approval/server/approval.service";
import { apiHandler, ok } from "@/lib/api/handler";

export const GET = apiHandler("configuration:read", async (_request, _context, actor) => ok(await getApprovalFormOptions(actor)));
