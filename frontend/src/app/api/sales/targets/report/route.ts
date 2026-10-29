import { targetReport } from "@/features/sales/targets/services/target.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET — Target Report: monthly target vs achievement per sales force. */
export const GET = apiHandler("sales:read", async (request, _context, actor) => ok(await targetReport(actor, Object.fromEntries(new URL(request.url).searchParams))));
