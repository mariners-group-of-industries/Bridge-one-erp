import { outletTracking } from "@/features/rtm/server/field.service";
import { get } from "@/features/rtm/server/routes";

/** ?date&srId&nodeId: one sales rep's field day — route, outlet statuses and totals. */
export const GET = get((actor, q) => outletTracking(actor, { date: q.date, srId: q.srId, nodeId: q.nodeId }));
