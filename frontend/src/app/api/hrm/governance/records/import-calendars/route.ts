import { importCalendarInfo } from "@/features/hrm/governance/server/policy-records.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** Copies Calendar Assign › Calendar Info into Calendar Setup (skips existing ones). */
export const POST = apiHandler("employees:read", async (_request, _context, actor) => ok(await importCalendarInfo(actor)));
