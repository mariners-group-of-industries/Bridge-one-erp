import { NextResponse } from "next/server";
import { getConnectPool } from "@/lib/connect/db";
import { getPusherServer } from "@/lib/connect/pusher-server";
import { getConnectAuthUser, ensureValidUuid } from "@/lib/connect/auth";

export async function GET(
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

    // Membership / Access Authorization Check
    const accessCheck = await pool.query(
      `SELECT c.type, cm.id AS "memberId"
       FROM connect_conversations c
       LEFT JOIN connect_conversation_members cm
         ON cm.conversation_id = c.id
         AND (
           cm.user_id = $2::uuid 
           OR cm.employee_id = $2::uuid
           OR cm.employee_id IN (SELECT id FROM employees WHERE "userId" = $2::uuid)
           OR cm.user_id IN (SELECT "userId" FROM employees WHERE id = $2::uuid)
         )
         AND cm.left_at IS NULL
       WHERE c.id = $1::uuid;`,
      [id, user.id]
    );

    if (accessCheck.rowCount === 0) {
      return NextResponse.json({ success: false, error: "Conversation not found" }, { status: 404 });
    }

    const row = accessCheck.rows[0];
    const isMember = Boolean(row.memberId);
    const isPublicGroup = row.type === "GROUP";

    if (!isMember && !isPublicGroup) {
      return NextResponse.json(
        { success: false, error: "Access denied. You are not a member of this conversation." },
        { status: 403 }
      );
    }

    // Fetch messages
    const query = `
      SELECT 
        m.id,
        m.conversation_id AS "conversationId",
        m.sender_id AS "senderId",
        COALESCE(u.name, e.name, 'Colleague') AS "senderName",
        m.client_msg_id AS "clientMsgId",
        m.type,
        m.body,
        m.reply_to_id AS "replyToId",
        m.erp_record_type AS "erpRecordType",
        m.erp_record_id AS "erpRecordId",
        m.erp_record_data AS "erpRecordData",
        m.edited_at AS "editedAt",
        m.deleted_at AS "deletedAt",
        m.created_at AS "createdAt",
        (
          SELECT json_agg(
            json_build_object(
              'id', a.id,
              'name', a.file_name,
              'sizeBytes', a.size_bytes,
              'mimeType', a.mime_type,
              'url', a.cdn_url
            )
          )
          FROM connect_attachments a
          WHERE a.message_id = m.id
        ) AS attachments
      FROM connect_messages m
      LEFT JOIN users u ON u.id = m.sender_id
      LEFT JOIN employees e ON (e.id = m.sender_id OR e."userId" = m.sender_id)
      WHERE m.conversation_id = $1::uuid
      ORDER BY m.created_at ASC
      LIMIT 100;
    `;
    const res = await pool.query(query, [id]);

    // Update last_read_message_id for this member if there are messages
    if (isMember && res.rows.length > 0) {
      const lastMsgId = res.rows[res.rows.length - 1].id;
      pool.query(
        `UPDATE connect_conversation_members
         SET last_read_message_id = $1::uuid
         WHERE conversation_id = $2::uuid
           AND (user_id = $3::uuid OR employee_id = $3::uuid);`,
        [lastMsgId, id, user.id]
      ).catch((err) => console.error("Error updating last_read_message_id:", err));
    }

    return NextResponse.json({ success: true, messages: res.rows });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch messages" }, { status: 500 });
  }
}

export async function POST(
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

    // Verify user can send messages to this conversation
    const accessCheck = await pool.query(
      `SELECT c.type, cm.id AS "memberId"
       FROM connect_conversations c
       LEFT JOIN connect_conversation_members cm
         ON cm.conversation_id = c.id
         AND (
           cm.user_id = $2::uuid 
           OR cm.employee_id = $2::uuid
           OR cm.employee_id IN (SELECT id FROM employees WHERE "userId" = $2::uuid)
           OR cm.user_id IN (SELECT "userId" FROM employees WHERE id = $2::uuid)
         )
         AND cm.left_at IS NULL
       WHERE c.id = $1::uuid;`,
      [id, user.id]
    );

    if (accessCheck.rowCount === 0) {
      return NextResponse.json({ success: false, error: "Conversation not found" }, { status: 404 });
    }

    const row = accessCheck.rows[0];
    if (!row.memberId && row.type !== "GROUP") {
      return NextResponse.json(
        { success: false, error: "Access denied. You cannot send messages to this conversation." },
        { status: 403 }
      );
    }

    // If joining a group without being an explicit member, auto-join as member
    if (!row.memberId && row.type === "GROUP") {
      await pool.query(
        `INSERT INTO connect_conversation_members (conversation_id, user_id, role)
         VALUES ($1::uuid, $2::uuid, 'MEMBER')
         ON CONFLICT (conversation_id, user_id) DO NOTHING;`,
        [id, user.id]
      );
    }

    const body = await req.json();
    const {
      clientMsgId,
      type,
      bodyText,
      replyToId,
      replyTo,
      erpRecordType,
      erpRecordId,
      erpRecordData,
      attachments,
    } = body;

    const client = await pool.connect();
    let savedMsg: Record<string, unknown> | null = null;

    try {
      await client.query("BEGIN");

      // Strictly use verified user.id as sender_id to prevent identity spoofing
      const insertMsg = `
        INSERT INTO connect_messages (
          conversation_id, sender_id, client_msg_id, type, body, reply_to_id,
          erp_record_type, erp_record_id, erp_record_data, created_at
        )
        VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
        RETURNING *;
      `;
      const msgRes = await client.query(insertMsg, [
        id,
        user.id,
        clientMsgId || `c-${Date.now()}`,
        type || "TEXT",
        bodyText || "",
        replyToId ? ensureValidUuid(replyToId) : null,
        erpRecordType || null,
        erpRecordId || null,
        erpRecordData ? JSON.stringify(erpRecordData) : null,
      ]);

      savedMsg = msgRes.rows[0];
      if (!savedMsg) {
        throw new Error("Failed to insert message");
      }

      // Save attachments if any
      const savedAttachments: Array<Record<string, unknown>> = [];
      if (Array.isArray(attachments) && attachments.length > 0) {
        for (const att of attachments) {
          const attRes = await client.query(
            `INSERT INTO connect_attachments (message_id, file_key, file_name, mime_type, size_bytes, cdn_url)
             VALUES ($1::uuid, $2, $3, $4, $5, $6)
             RETURNING id, file_name AS name, size_bytes AS "sizeBytes", mime_type AS "mimeType", cdn_url AS url;`,
            [
              savedMsg.id,
              att.fileKey || `file-${Date.now()}`,
              att.name,
              att.mimeType || "application/octet-stream",
              att.sizeBytes || 0,
              att.url || "#",
            ]
          );
          if (attRes.rows[0]) {
            savedAttachments.push(attRes.rows[0]);
          }
        }
      }

      // Auto update sender's last_read_message_id
      await client.query(
        `UPDATE connect_conversation_members
         SET last_read_message_id = $1::uuid
         WHERE conversation_id = $2::uuid
           AND (user_id = $3::uuid OR employee_id = $3::uuid);`,
        [savedMsg.id, id, user.id]
      );

      await client.query("COMMIT");

      // Broadcast new message via Pusher
      const pusher = getPusherServer();
      if (pusher && savedMsg) {
        const broadcastPayload = {
          id: savedMsg.id,
          conversationId: id,
          senderId: savedMsg.sender_id,
          senderName: user.name || "Colleague",
          clientMsgId: savedMsg.client_msg_id,
          type: (savedMsg.type as string)?.toLowerCase() || "text",
          body: savedMsg.body,
          replyTo: replyTo || undefined,
          erpRecord: erpRecordData || undefined,
          attachments: savedAttachments.length > 0 ? savedAttachments : (attachments || []),
          status: "delivered",
          createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };

        try {
          await pusher.trigger([`chat-${id}`, "connect-global"], "new-message", broadcastPayload);
        } catch (pushErr) {
          console.error("[Pusher error] Failed to trigger new-message:", pushErr);
        }
      }

      return NextResponse.json({ success: true, message: savedMsg });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error creating message:", error);
    return NextResponse.json({ success: false, error: "Failed to send message" }, { status: 500 });
  }
}
