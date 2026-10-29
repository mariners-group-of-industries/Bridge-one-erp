import { planReport } from "@/features/sales/targets/services/target.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET — Sales Target Report: achievement, collection and commission per assigned sales force. */
export const GET = apiHandler("sales:read", async (request, _context, actor) => ok(await planReport(actor, Object.fromEntries(new URL(request.url).searchParams))));
