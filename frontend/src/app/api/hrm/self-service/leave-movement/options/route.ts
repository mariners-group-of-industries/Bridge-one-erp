import { leaveMovementOptions } from "@/features/hrm/self-service/leave-movement/server/leave-movement.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** Who the Leave & Movement page is for: the linked employee, and whether HR controls are shown. */
export const GET = apiHandler("employees:read", async (_request, _context, actor) => ok(await leaveMovementOptions(actor)));
