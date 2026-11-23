import { employeeLastActivity } from "@/features/rtm/server/field.service";
import { get } from "@/features/rtm/server/routes";

/** Employee wise tracking (?nodeId&srId): each employee's latest activity and location. */
export const GET = get((actor, q) => employeeLastActivity(actor, q));
