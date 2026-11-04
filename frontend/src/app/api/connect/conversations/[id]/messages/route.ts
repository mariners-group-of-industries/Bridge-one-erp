import { NextResponse } from "next/server";
import { getConnectPool } from "@/lib/connect/db";
import { getPusherServer } from "@/lib/connect/pusher-server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pool = getConnectPool();

    const query = `
      SELECT 
        m.id,
        m.conversation_id AS "conversationId",
        m.sender_id AS "senderId",
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
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
      LIMIT 100;
    `;
    const res = await pool.query(query, [id]);
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
    const body = await req.json();
    const {
      senderId,
      senderName,
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

    const pool = getConnectPool();
    const client = await pool.connect();
    let savedMsg: Record<string, unknown> | null = null;

    try {
      await client.query("BEGIN");

      const insertMsg = `
        INSERT INTO connect_messages (
          conversation_id, sender_id, client_msg_id, type, body, reply_to_id,
          erp_record_type, erp_record_id, erp_record_data, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
        RETURNING *;
      `;
      const msgRes = await client.query(insertMsg, [
        id,
        senderId || "00000000-0000-0000-0000-000000000099",
        clientMsgId || `c-${Date.now()}`,
        type || "TEXT",
        bodyText || "",
        replyToId || null,
        erpRecordType || null,
        erpRecordId || null,
        erpRecordData ? JSON.stringify(erpRecordData) : null,
      ]);

      savedMsg = msgRes.rows[0];

      // Save attachments if any
      const savedAttachments: Array<Record<string, unknown>> = [];
      if (Array.isArray(attachments) && attachments.length > 0) {
        for (const att of attachments) {
          const attRes = await client.query(
            `INSERT INTO connect_attachments (message_id, file_key, file_name, mime_type, size_bytes, cdn_url)
             VALUES ($1, $2, $3, $4, $5, $6)
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

      await client.query("COMMIT");

      // Broadcast new message via Pusher
      const pusher = getPusherServer();
      if (pusher && savedMsg) {
        const broadcastPayload = {
          id: savedMsg.id,
          conversationId: id,
          senderId: savedMsg.sender_id,
          senderName: senderName || "Colleague",
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
