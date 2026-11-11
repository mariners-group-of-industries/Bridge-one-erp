import { outletLedger } from "@/features/rtm/server/sales.service";
import { get } from "@/features/rtm/server/routes";

/** ?outletId&from&to: an outlet's ledger. */
export const GET = get((actor, q) => outletLedger(actor, q.outletId ?? "", q.from, q.to));
