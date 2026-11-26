import { listOutlets, saveOutlet } from "@/features/rtm/server/outlet.service";
import { get, write } from "@/features/rtm/server/routes";

/** Outlets; POST creates one (it waits for Outlet Setup Approval). */
export const GET = get((actor) => listOutlets(actor));
export const POST = write((actor, body) => saveOutlet(actor, body), 201);
