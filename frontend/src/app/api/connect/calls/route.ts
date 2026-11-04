import { NextResponse } from "next/server";
import { connectRoute } from "@/lib/connect/route";
import { getConnectPool } from "@/lib/connect/db";

async function handleGET() {
  try {
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
      ORDER BY c.started_at DESC
      LIMIT 50;
    `;
    const res = await pool.query(query);
    return NextResponse.json({ success: true, calls: res.rows });
  } catch (error) {
    console.error("Error fetching calls:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch calls" }, { status: 500 });
  }
}

async function handlePOST(req: Request) {
  try {
    const body = await req.json();
    const { conversationId, startedById, type, status, durationSec } = body;

    const pool = getConnectPool();
    const query = `
      INSERT INTO connect_calls (conversation_id, started_by_id, type, status, duration_sec, started_at, ended_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP - ($5 || ' seconds')::interval, CURRENT_TIMESTAMP)
      RETURNING *;
    `;
    const res = await pool.query(query, [
      conversationId || "00000000-0000-0000-0000-000000000001",
      startedById || "00000000-0000-0000-0000-000000000099",
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


export const GET = connectRoute("employees:read", handleGET);
export const POST = connectRoute("configuration:write", handlePOST);
