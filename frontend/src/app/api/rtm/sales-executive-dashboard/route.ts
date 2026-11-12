import { salesExecutiveDashboard } from "@/features/rtm/server/reports.service";
import { get } from "@/features/rtm/server/routes";

/** ?month: each SR's target vs achievement. */
export const GET = get((actor, q) => salesExecutiveDashboard(actor, q.month ?? ""));
