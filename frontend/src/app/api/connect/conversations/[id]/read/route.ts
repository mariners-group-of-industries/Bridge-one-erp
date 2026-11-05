import { NextResponse } from "next/server";
import { getConnectPool } from "@/lib/connect/db";
import { getConnectAuthUser } from "@/lib/connect/auth";
import { getPusherServer } from "@/lib/connect/pusher-server";
import { connectRoute } from "@/lib/connect/route";

async function handlePOST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getConnectAuthUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const pool = getConnectPool();

    // 1. Find the latest message in this conversation
    const latestMsgRes = await pool.query(
      `SELECT id FROM connect_messages 
       WHERE conversation_id = $1::uuid 
       ORDER BY created_at DESC 
       LIMIT 1;`,
      [id]
    );

    if (latestMsgRes.rowCount && latestMsgRes.rowCount > 0) {
      const lastMsgId = latestMsgRes.rows[0].id;

      // 2. Update last_read_message_id for this member
      await pool.query(
        `UPDATE connect_conversation_members
         SET last_read_message_id = $1::uuid,
             left_at = NULL
         WHERE conversation_id = $2::uuid
           AND (
             user_id = $3::uuid 
             OR employee_id = $3::uuid
             OR employee_id IN (SELECT id FROM employees WHERE "userId" = $3::uuid)
             OR user_id IN (SELECT "userId" FROM employees WHERE id = $3::uuid)
           );`,
        [lastMsgId, id, user.id]
      );
    }

    // 3. Broadcast real-time seen event over Pusher
    const pusher = getPusherServer();
    if (pusher) {
      await pusher.trigger([`chat-${id}`, "connect-global"], "messages-seen", {
        conversationId: id,
        readerId: user.id,
        readerName: user.name,
        timestamp: Date.now(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    return NextResponse.json(
      { success: false, error: "Failed to mark messages as read" },
      { status: 500 }
    );
  }
}

export const POST = connectRoute("configuration:write", handlePOST);
