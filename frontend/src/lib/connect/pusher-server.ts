import Pusher from "pusher";

let pusherServerInstance: Pusher | null = null;

export function getPusherServer(): Pusher | null {
  const appId = process.env.PUSHER_APP_ID || "2209298";
  const key = process.env.PUSHER_KEY || "30ba2c8404c976fb364e";
  const secret = process.env.PUSHER_SECRET || "0a5dc87a859daa833209";
  const cluster = process.env.PUSHER_CLUSTER || "ap2";

  if (!appId || !key || !secret) {
    console.warn("[Pusher Server] Missing Pusher configuration");
    return null;
  }

  if (!pusherServerInstance) {
    pusherServerInstance = new Pusher({
      appId,
      key,
      secret,
      cluster,
      useTLS: true,
    });
  }

  return pusherServerInstance;
}

