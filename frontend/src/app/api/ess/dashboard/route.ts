import { myDashboard } from "@/features/ess/server/ess.service";
import { apiHandler, ok } from "@/lib/api/handler";

export const GET = apiHandler("employees:read", async (_request, _context, actor) => ok(await myDashboard(actor)));
