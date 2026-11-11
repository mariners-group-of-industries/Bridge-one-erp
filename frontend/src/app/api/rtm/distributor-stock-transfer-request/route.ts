import { listTransfers, requestTransfer } from "@/features/rtm/server/stock.service";
import { get, write } from "@/features/rtm/server/routes";

/** Stock transfer requests. */
export const GET = get((actor, q) => listTransfers(actor, q));
export const POST = write((actor, body) => requestTransfer(actor, body), 201);
