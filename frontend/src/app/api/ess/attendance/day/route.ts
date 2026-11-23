import { myAttendanceDay } from "@/features/ess/server/ess-attendance.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** ?date=YYYY-MM-DD: one day with its device punches. */
export const GET = apiHandler("employees:read", async (request, _context, actor) => ok(await myAttendanceDay(actor, new URL(request.url).searchParams.get("date") ?? "")));
