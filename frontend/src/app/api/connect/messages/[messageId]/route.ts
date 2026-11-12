import { NextResponse } from "next/server";
import { getConnectPool } from "@/lib/connect/db";
import { getPusherServer } from "@/lib/connect/pusher-server";
import { getConnectAuthUser } from "@/lib/connect/auth";
import { connectRoute } from "@/lib/connect/route";

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

async function handlePATCH(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params;
    const user = await getConnectAuthUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { newBody } = body;

    if (!newBody || typeof newBody !== "string" || !newBody.trim()) {
      return NextResponse.json({ success: false, error: "newBody string required" }, { status: 400 });
    }

    const pool = getConnectPool();

    // 1. Fetch message and verify ownership
    const msgRes = await pool.query(
      `SELECT id, conversation_id, sender_id, created_at, deleted_at 
       FROM connect_messages 
       WHERE id = $1::uuid;`,
      [messageId]
    );

    if (msgRes.rowCount === 0) {
      return NextResponse.json({ success: false, error: "Message not found" }, { status: 404 });
    }

    const targetMsg = msgRes.rows[0];

    // 2. Check if already deleted
    if (targetMsg.deleted_at) {
      return NextResponse.json({ success: false, error: "Cannot edit a deleted message" }, { status: 400 });
    }

    // 3. Sender ownership check
    if (targetMsg.sender_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "Forbidden. You can only edit your own messages." },
        { status: 403 }
      );
    }

    // 4. 15-Minute Time Limit Check
    const messageAgeMs = Date.now() - new Date(targetMsg.created_at).getTime();
    if (messageAgeMs > FIFTEEN_MINUTES_MS) {
      return NextResponse.json(
        { success: false, error: "Edit window expired. Messages can only be edited within 15 minutes of sending." },
        { status: 400 }
      );
    }

    // 5. Update message
    const updateRes = await pool.query(
      `UPDATE connect_messages
       SET body = $1, edited_at = CURRENT_TIMESTAMP
       WHERE id = $2::uuid
       RETURNING *;`,
      [newBody.trim(), messageId]
    );

    const updated = updateRes.rows[0];

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

async function handleDELETE(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params;
    const user = await getConnectAuthUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const pool = getConnectPool();

    // 1. Fetch message details
    const msgRes = await pool.query(
      `SELECT id, conversation_id, sender_id, created_at, deleted_at 
       FROM connect_messages 
       WHERE id = $1::uuid;`,
      [messageId]
    );

    if (msgRes.rowCount === 0) {
      return NextResponse.json({ success: false, error: "Message not found" }, { status: 404 });
    }

    const targetMsg = msgRes.rows[0];

    // 2. Check if already deleted
    if (targetMsg.deleted_at) {
      return NextResponse.json({ success: true, message: targetMsg });
    }

    // 3. Check authorization: sender OR channel ADMIN
    const isSender = targetMsg.sender_id === user.id;
    let isAdmin = false;

    if (!isSender) {
      const adminCheck = await pool.query(
        `SELECT role FROM connect_conversation_members 
         WHERE conversation_id = $1::uuid 
           AND (user_id = $2::uuid OR employee_id = $2::uuid)
           AND role = 'ADMIN'
           AND left_at IS NULL;`,
        [targetMsg.conversation_id, user.id]
      );
      isAdmin = (adminCheck.rowCount ?? 0) > 0;
    }

    if (!isSender && !isAdmin) {
      return NextResponse.json(
        { success: false, error: "Forbidden. You can only delete your own messages unless you are a channel admin." },
        { status: 403 }
      );
    }

    // 4. For regular sender (not admin), enforce 15-minute time limit
    if (isSender && !isAdmin) {
      const messageAgeMs = Date.now() - new Date(targetMsg.created_at).getTime();
      if (messageAgeMs > FIFTEEN_MINUTES_MS) {
        return NextResponse.json(
          { success: false, error: "Delete window expired. Messages can only be deleted within 15 minutes of sending." },
          { status: 400 }
        );
      }
    }

    // 5. Soft-delete message and remove attachments
    const deleteRes = await pool.query(
      `UPDATE connect_messages
       SET body = 'This message was deleted', deleted_at = CURRENT_TIMESTAMP, erp_record_data = NULL
       WHERE id = $1::uuid
       RETURNING *;`,
      [messageId]
    );

    await pool.query(
      `DELETE FROM connect_attachments WHERE message_id = $1::uuid;`,
      [messageId]
    );

    const deleted = deleteRes.rows[0];

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

export const PATCH = connectRoute("configuration:write", handlePATCH);
export const DELETE = connectRoute("configuration:write", handleDELETE);
