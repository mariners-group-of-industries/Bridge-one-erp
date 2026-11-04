import { NextResponse } from "next/server";
import { getConnectAuthUser } from "@/lib/connect/auth";
import { getPusherServer } from "@/lib/connect/pusher-server";

// In-memory heartbeat tracker for real-time user presence
interface ActivePresence {
  id: string;
  name: string;
  lastSeen: number;
}

const activePresenceMap = new Map<string, ActivePresence>();

// Heartbeat timeout threshold: 45 seconds
const PRESENCE_TIMEOUT_MS = 45000;

function cleanupStalePresence() {
  const now = Date.now();
  for (const [id, pres] of activePresenceMap.entries()) {
    if (now - pres.lastSeen > PRESENCE_TIMEOUT_MS) {
      activePresenceMap.delete(id);
    }
  }
}

export async function GET(req: Request) {
  try {
    const user = await getConnectAuthUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    cleanupStalePresence();

    const onlineUserIds = Array.from(activePresenceMap.keys());
    const presenceData: Record<string, { lastSeen: number }> = {};
    for (const [id, pres] of activePresenceMap.entries()) {
      presenceData[id] = { lastSeen: pres.lastSeen };
    }

    return NextResponse.json({
      success: true,
      onlineUserIds,
      users: presenceData,
    });
  } catch (error) {
    console.error("Error fetching presence:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch presence" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getConnectAuthUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    let action = "heartbeat";
    try {
      const body = await req.json();
      if (body?.action) action = body.action;
    } catch {
      // Body may be empty in beacon ping
    }

    const pusher = getPusherServer();
    const now = Date.now();

    if (action === "offline") {
      activePresenceMap.delete(user.id);
      if (pusher) {
        pusher.trigger("connect-global", "user-presence", {
          userId: user.id,
          userName: user.name,
          status: "offline",
          lastSeen: now,
        }).catch(() => {});
      }
      return NextResponse.json({ success: true, status: "offline" });
    }

    // Default: heartbeat / online
    const isNewOnline = !activePresenceMap.has(user.id);
    activePresenceMap.set(user.id, {
      id: user.id,
      name: user.name,
      lastSeen: now,
    });

    // Broadcast presence update if user just came online or every heartbeat
    if (pusher && isNewOnline) {
      pusher.trigger("connect-global", "user-presence", {
        userId: user.id,
        userName: user.name,
        status: "online",
        lastSeen: now,
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, status: "online" });
  } catch (error) {
    console.error("Error updating presence:", error);
    return NextResponse.json({ success: false, error: "Failed to update presence" }, { status: 500 });
  }
}
