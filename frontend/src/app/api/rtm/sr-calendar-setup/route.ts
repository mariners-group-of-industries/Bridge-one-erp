import { getCalendar, saveCalendar } from "@/features/rtm/server/field.service";
import { get, write } from "@/features/rtm/server/routes";

/** ?employeeId&month: an SR's month. PUT saves days. */
export const GET = get((actor, q) => getCalendar(actor, q.employeeId ?? "", q.month ?? ""));
export const PUT = write((actor, body) => saveCalendar(actor, body));
