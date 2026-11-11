import { readSettings, saveSettings } from "@/features/rtm/server/masters.service";
import { get, write } from "@/features/rtm/server/routes";

/** RTM settings of a business unit. */
export const GET = get((actor, q) => readSettings(actor, q.businessUnitId));
export const PUT = write((actor, body) => saveSettings(actor, body));
