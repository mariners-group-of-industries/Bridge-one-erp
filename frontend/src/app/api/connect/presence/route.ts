import { NextResponse } from "next/server";
import { getConnectAuthUser } from "@/lib/connect/auth";
import { getConnectPool } from "@/lib/connect/db";
import { getPusherServer } from "@/lib/connect/pusher-server";
import { connectRoute } from "@/lib/connect/route";

// In-memory heartbeat tracker for real-time user presence
interface ActivePresence {
  id: string;
  name: string;
  lastSeen: number;
}

const activePresenceMap = new Map<string, ActivePresence>();

// Heartbeat timeout threshold: 40 seconds
const PRESENCE_TIMEOUT_MS = 40000;

function cleanupStalePresence() {
  const now = Date.now();
  for (const [id, pres] of activePresenceMap.entries()) {
    if (now - pres.lastSeen > PRESENCE_TIMEOUT_MS) {
      activePresenceMap.delete(id);
    }
  }
}

async function handleGET(req: Request) {
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

async function handlePOST(req: Request) {
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

    // Resolve employee id if any
    let empId: string | null = null;
    try {
      const pool = getConnectPool();
      const empRes = await pool.query(
        `SELECT id FROM employees WHERE "userId" = $1::uuid LIMIT 1`,
        [user.id]
      );
      if (empRes.rowCount && empRes.rowCount > 0) {
        empId = empRes.rows[0].id;
      }
    } catch {
      // Ignored
    }

    const pusher = getPusherServer();
    const now = Date.now();

    if (action === "offline") {
      activePresenceMap.delete(user.id);
      if (empId) activePresenceMap.delete(empId);

      if (pusher) {
        pusher.trigger("connect-global", "user-presence", {
          userId: user.id,
          employeeId: empId,
          userName: user.name,
          status: "offline",
          lastSeen: now,
        }).catch(() => {});
      }
      return NextResponse.json({ success: true, status: "offline" });
    }

    // Default: heartbeat / online
    activePresenceMap.set(user.id, {
      id: user.id,
      name: user.name,
      lastSeen: now,
    });
    if (empId) {
      activePresenceMap.set(empId, {
        id: empId,
        name: user.name,
        lastSeen: now,
      });
    }

    // Real-time broadcast presence update to all connected clients
    if (pusher) {
      pusher.trigger("connect-global", "user-presence", {
        userId: user.id,
        employeeId: empId,
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

export const GET = connectRoute("employees:read", handleGET);
export const POST = connectRoute("configuration:write", handlePOST);
