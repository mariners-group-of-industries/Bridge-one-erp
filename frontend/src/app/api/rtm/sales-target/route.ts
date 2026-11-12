import { createTarget, listTargets } from "@/features/rtm/server/masters.service";
import { get, write } from "@/features/rtm/server/routes";

/** Targets (?month). */
export const GET = get((actor, q) => listTargets(actor, q.month));
export const POST = write((actor, body) => createTarget(actor, body), 201);
