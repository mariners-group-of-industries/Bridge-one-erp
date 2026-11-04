import { NextResponse } from "next/server";
import { connectRoute } from "@/lib/connect/route";
import { getConnectPool } from "@/lib/connect/db";

async function handleGET(
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

async function handlePOST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      senderId,
      clientMsgId,
      type,
      bodyText,
      replyToId,
      erpRecordType,
      erpRecordId,
      erpRecordData,
      attachments,
    } = body;

    const pool = getConnectPool();
    const client = await pool.connect();
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

      const savedMsg = msgRes.rows[0];

      // Save attachments if any
      if (Array.isArray(attachments) && attachments.length > 0) {
        for (const att of attachments) {
          await client.query(
            `INSERT INTO connect_attachments (message_id, file_key, file_name, mime_type, size_bytes, cdn_url)
             VALUES ($1, $2, $3, $4, $5, $6);`,
            [
              savedMsg.id,
              att.fileKey || `file-${Date.now()}`,
              att.name,
              att.mimeType || "application/octet-stream",
              att.sizeBytes || 0,
              att.url || "#",
            ]
          );
        }
      }

      await client.query("COMMIT");
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


export const GET = connectRoute("employees:read", handleGET);
export const POST = connectRoute("configuration:write", handlePOST);
