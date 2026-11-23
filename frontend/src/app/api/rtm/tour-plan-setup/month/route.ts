import { saveTourPlanMonth, tourPlanMonth } from "@/features/rtm/server/field.service";
import { get, write } from "@/features/rtm/server/routes";

/** GET ?employeeId&year&month: the month's days and plans. POST saves the month (days not yet approved). */
export const GET = get((actor, q) => tourPlanMonth(actor, q));
export const POST = write((actor, body) => saveTourPlanMonth(actor, body));
