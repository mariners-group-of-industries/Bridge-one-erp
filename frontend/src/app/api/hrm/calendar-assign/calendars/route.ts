import { calendarDefinitions } from "@/features/hrm/calendar-assign/services/calendar-assign.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** The calendars of HR Governance › Calendar Setup, plus Weekly Off and Holiday (Calendar Assign, Attendance). */
export const GET = apiHandler("employees:read", async () => ok(await calendarDefinitions()));
