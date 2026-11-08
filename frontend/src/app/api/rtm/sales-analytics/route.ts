import { salesAnalytics } from "@/features/rtm/server/reports.service";
import { get } from "@/features/rtm/server/routes";

/** ?from&to: secondary sales by month, channel, route, distributor, SR and item. */
export const GET = get((actor, q) => salesAnalytics(actor, q.from ?? "", q.to ?? ""));
