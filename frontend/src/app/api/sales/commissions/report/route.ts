import { commissionReport } from "@/features/sales/targets/services/target.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET — Commission Report: commission earned on deliveries, net of returns. */
export const GET = apiHandler("sales:read", async (request, _context, actor) => ok(await commissionReport(actor, Object.fromEntries(new URL(request.url).searchParams))));
