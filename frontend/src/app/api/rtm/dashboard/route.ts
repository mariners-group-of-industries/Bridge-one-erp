import { rtmDashboard } from "@/features/rtm/server/reports.service";
import { get } from "@/features/rtm/server/routes";

/** ?from&to: RTM dashboard. */
export const GET = get((actor, q) => rtmDashboard(actor, q.from ?? "", q.to ?? ""));
