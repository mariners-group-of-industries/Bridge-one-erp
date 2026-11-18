import { myCalendar } from "@/features/ess/server/ess-attendance.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** ?month=YYYY-MM (default: this month). */
export const GET = apiHandler("employees:read", async (request, _context, actor) => ok(await myCalendar(actor, new URL(request.url).searchParams.get("month") ?? "")));
