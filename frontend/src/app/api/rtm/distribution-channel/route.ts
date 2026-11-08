import { listChannels, saveChannel } from "@/features/rtm/server/masters.service";
import { get, write } from "@/features/rtm/server/routes";

/** Distribution channels. */
export const GET = get((actor) => listChannels(actor));
export const POST = write((actor, body) => saveChannel(actor, body), 201);
