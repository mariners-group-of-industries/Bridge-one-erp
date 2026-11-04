import { NextResponse } from "next/server";
import { getConnectPool } from "@/lib/connect/db";
import { getPusherServer } from "@/lib/connect/pusher-server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params;
    const body = await req.json();
    const { newBody } = body;

    if (!newBody || typeof newBody !== "string") {
      return NextResponse.json({ success: false, error: "newBody string required" }, { status: 400 });
    }

    const pool = getConnectPool();
    const query = `
      UPDATE connect_messages
      SET body = $1, edited_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const res = await pool.query(query, [newBody, messageId]);
    if (res.rowCount === 0) {
      return NextResponse.json({ success: false, error: "Message not found" }, { status: 404 });
    }

    const updated = res.rows[0];

    // Broadcast edit via Pusher
    const pusher = getPusherServer();
    if (pusher && updated) {
      try {
        await pusher.trigger(`chat-${updated.conversation_id}`, "message-edited", {
          messageId: updated.id,
          conversationId: updated.conversation_id,
          newBody: updated.body,
          editedAt: updated.edited_at,
        });
      } catch (err) {
        console.error("[Pusher error] Failed to trigger message-edited:", err);
      }
    }

    return NextResponse.json({ success: true, message: updated });
  } catch (error) {
    console.error("Error editing message:", error);
    return NextResponse.json({ success: false, error: "Failed to edit message" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params;
    const pool = getConnectPool();
    const query = `
      UPDATE connect_messages
      SET body = 'This message was deleted', deleted_at = CURRENT_TIMESTAMP, erp_record_data = NULL
      WHERE id = $1
      RETURNING *;
    `;
    const res = await pool.query(query, [messageId]);
    if (res.rowCount === 0) {
      return NextResponse.json({ success: false, error: "Message not found" }, { status: 404 });
    }

    const deleted = res.rows[0];

    // Broadcast delete via Pusher
    const pusher = getPusherServer();
    if (pusher && deleted) {
      try {
        await pusher.trigger(`chat-${deleted.conversation_id}`, "message-deleted", {
          messageId: deleted.id,
          conversationId: deleted.conversation_id,
        });
      } catch (err) {
        console.error("[Pusher error] Failed to trigger message-deleted:", err);
      }
    }

    return NextResponse.json({ success: true, message: deleted });
  } catch (error) {
    console.error("Error deleting message:", error);
    return NextResponse.json({ success: false, error: "Failed to delete message" }, { status: 500 });
  }
}
