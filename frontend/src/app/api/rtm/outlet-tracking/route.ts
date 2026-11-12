import { outletTracking } from "@/features/rtm/server/field.service";
import { get } from "@/features/rtm/server/routes";

/** ?from&to: visits and orders per outlet. */
export const GET = get((actor, q) => outletTracking(actor, q.from ?? "", q.to ?? ""));
