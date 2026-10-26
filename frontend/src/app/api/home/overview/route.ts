import { getBusinessOverview } from "@/features/home/overview.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** Home dashboard figures for the last 12 months. */
export const GET = apiHandler("sales:read", async (_request, _context, actor) => ok(await getBusinessOverview(actor)));
