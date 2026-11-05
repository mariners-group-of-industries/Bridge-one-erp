import { NextResponse } from "next/server";
import { connectRoute } from "@/lib/connect/route";
import { getConnectPool } from "@/lib/connect/db";
import { getConnectAuthUser, ensureValidUuid } from "@/lib/connect/auth";

export async function GET(req: Request) {
  try {
    const user = await getConnectAuthUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const pool = getConnectPool();
    const query = `
      SELECT 
        c.id,
        c.conversation_id AS "conversationId",
        c.started_by_id AS "startedById",
        c.type,
        c.status,
        c.started_at AS "startedAt",
        c.ended_at AS "endedAt",
        c.duration_sec AS "durationSec",
        conv.name AS "conversationName",
        conv.type AS "conversationType"
      FROM connect_calls c
      LEFT JOIN connect_conversations conv ON conv.id = c.conversation_id
      LEFT JOIN connect_conversation_members cm 
        ON cm.conversation_id = c.conversation_id 
        AND (cm.user_id = $1::uuid OR cm.employee_id = $1::uuid)
      WHERE c.started_by_id = $1::uuid OR cm.id IS NOT NULL
      ORDER BY c.started_at DESC
      LIMIT 50;
    `;
    const res = await pool.query(query, [user.id]);
    return NextResponse.json({ success: true, calls: res.rows });
  } catch (error) {
    console.error("Error fetching calls:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch calls" }, { status: 500 });
  }
}

async function handlePOST(req: Request) {
  try {
    const user = await getConnectAuthUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { conversationId, type, status, durationSec } = body;

    const pool = getConnectPool();
    const query = `
      INSERT INTO connect_calls (conversation_id, started_by_id, type, status, duration_sec, started_at, ended_at)
      VALUES ($1::uuid, $2::uuid, $3, $4, $5, CURRENT_TIMESTAMP - ($5 || ' seconds')::interval, CURRENT_TIMESTAMP)
      RETURNING *;
    `;
    const res = await pool.query(query, [
      ensureValidUuid(conversationId),
      user.id,
      type || "AUDIO",
      status || "COMPLETED",
      durationSec || 0,
    ]);
    return NextResponse.json({ success: true, call: res.rows[0] });
  } catch (error) {
    console.error("Error logging call:", error);
    return NextResponse.json({ success: false, error: "Failed to log call" }, { status: 500 });
  }
}
