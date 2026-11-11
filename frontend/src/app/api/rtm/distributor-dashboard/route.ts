import { distributorDashboard } from "@/features/rtm/server/reports.service";
import { get } from "@/features/rtm/server/routes";

/** ?distributorId&from&to: one distributor's dashboard. */
export const GET = get((actor, q) => distributorDashboard(actor, q.distributorId ?? "", q.from ?? "", q.to ?? ""));
