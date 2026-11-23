import { listTransfers, requestTransfer } from "@/features/rtm/server/stock.service";
import { get, write } from "@/features/rtm/server/routes";

/** Transfers to issue (approved) and issued; POST raises a transfer (it still goes through approval). */
export const GET = get((actor, q) => listTransfers(actor, q));
export const POST = write((actor, body) => requestTransfer(actor, body), 201);
