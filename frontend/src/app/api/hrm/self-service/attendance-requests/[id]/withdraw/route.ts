import { withdrawOwnAttendanceRequest } from "@/features/hrm/attendance/services/attendance.service";
import { apiHandler, noContent, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

/** Withdraws one of the signed-in employee's own pending attendance requests. */
export const POST = apiHandler("employees:read", async (_request, context: Context, actor) => {
  await withdrawOwnAttendanceRequest(actor, parseId((await context.params).id, "Attendance request"));
  return noContent();
});
