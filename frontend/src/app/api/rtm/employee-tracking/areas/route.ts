import { areaActivity } from "@/features/rtm/server/field.service";
import { get } from "@/features/rtm/server/routes";

/** Area wise tracking (?nodeId&srId): per area, sales force, active today and the latest activity. */
export const GET = get((actor, q) => areaActivity(actor, q));
