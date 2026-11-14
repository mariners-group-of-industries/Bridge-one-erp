import { getApprovalSummary } from "@/features/approvals/server/summary.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** Multilayer Approval: pending / approved / rejected counts for every approval category the user may see. */
export const GET = apiHandler("configuration:read", async (_request, _context, actor) => ok(await getApprovalSummary(actor)));
