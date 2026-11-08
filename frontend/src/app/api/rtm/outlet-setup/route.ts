import { listOutlets, saveOutlet } from "@/features/rtm/server/masters.service";
import { get, write } from "@/features/rtm/server/routes";

/** Outlets. */
export const GET = get((actor) => listOutlets(actor));
export const POST = write((actor, body) => saveOutlet(actor, body), 201);
