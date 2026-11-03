import { NextResponse } from "next/server";
import { getConnectPool } from "@/lib/connect/db";

export async function GET() {
  try {
    const pool = getConnectPool();
    const query = `
      SELECT 
        c.id,
        c.type,
        c.name,
        c.description,
        c.avatar_url AS "avatarUrl",
        c.is_archived AS "isArchived",
        c.created_at AS "createdAt",
        (
          SELECT json_build_object(
            'id', m.id,
            'body', m.body,
            'type', m.type,
            'createdAt', m.created_at,
            'senderId', m.sender_id
          )
          FROM connect_messages m
          WHERE m.conversation_id = c.id
          ORDER BY m.created_at DESC
          LIMIT 1
        ) AS "lastMessage",
        (
          SELECT COUNT(*)::int
          FROM connect_conversation_members cm
          WHERE cm.conversation_id = c.id
        ) AS "memberCount"
      FROM connect_conversations c
      WHERE c.is_archived = false
      ORDER BY c.created_at DESC;
    `;
    const result = await pool.query(query);
    return NextResponse.json({ success: true, conversations: result.rows });
  } catch (error) {
    console.error("Error fetching connect conversations:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch conversations" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, name, description, avatarUrl, memberUserIds } = body;

    if (!name && type === "GROUP") {
      return NextResponse.json({ success: false, error: "Group name is required" }, { status: 400 });
    }

    const pool = getConnectPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const insertConvQuery = `
        INSERT INTO connect_conversations (type, name, description, avatar_url, is_archived)
        VALUES ($1, $2, $3, $4, false)
        RETURNING *;
      `;
      const convRes = await client.query(insertConvQuery, [
        type || "DIRECT",
        name || "New Conversation",
        description || null,
        avatarUrl || null,
      ]);
      const newConv = convRes.rows[0];

      // Insert members if provided
      if (Array.isArray(memberUserIds) && memberUserIds.length > 0) {
        for (const uid of memberUserIds) {
          await client.query(
            `INSERT INTO connect_conversation_members (conversation_id, user_id, role)
             VALUES ($1, $2, 'MEMBER')
             ON CONFLICT (conversation_id, user_id) DO NOTHING;`,
            [newConv.id, uid]
          );
        }
      }

      await client.query("COMMIT");
      return NextResponse.json({ success: true, conversation: newConv });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error creating conversation:", error);
    return NextResponse.json({ success: false, error: "Failed to create conversation" }, { status: 500 });
  }
}
