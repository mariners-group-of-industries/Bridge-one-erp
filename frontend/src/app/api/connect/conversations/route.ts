import { NextResponse } from "next/server";
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
          FROM connect_conversation_members cm_count
          WHERE cm_count.conversation_id = c.id
        ) AS "memberCount"
      FROM connect_conversations c
      LEFT JOIN connect_conversation_members cm 
        ON cm.conversation_id = c.id 
        AND (cm.user_id = $1::uuid OR cm.employee_id = $1::uuid)
        AND cm.left_at IS NULL
      WHERE c.is_archived = false
        AND (
          -- User is an active member
          cm.id IS NOT NULL
          -- OR user created it
          OR c.created_by_id = $1::uuid
          -- OR public general group channels
          OR (c.type = 'GROUP' AND c.name ILIKE '%general%')
        )
      ORDER BY c.created_at DESC;
    `;
    const result = await pool.query(query, [user.id]);
    return NextResponse.json({ success: true, conversations: result.rows });
  } catch (error) {
    console.error("Error fetching connect conversations:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch conversations" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getConnectAuthUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { type, name, description, avatarUrl, memberUserIds } = body;

    const convType = type === "GROUP" ? "GROUP" : "DIRECT";

    if (!name && convType === "GROUP") {
      return NextResponse.json({ success: false, error: "Group name is required" }, { status: 400 });
    }

    const pool = getConnectPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // For 1-to-1 DIRECT conversations, check if an existing chat between these 2 users already exists
      if (convType === "DIRECT" && Array.isArray(memberUserIds) && memberUserIds.length > 0) {
        const otherUserId = ensureValidUuid(memberUserIds[0]);
        const existingCheck = await client.query(
          `SELECT c.id, c.name, c.type, c.created_at AS "createdAt"
           FROM connect_conversations c
           WHERE c.type = 'DIRECT' AND c.is_archived = false
             AND EXISTS (
               SELECT 1 FROM connect_conversation_members 
               WHERE conversation_id = c.id AND (user_id = $1::uuid OR employee_id = $1::uuid)
             )
             AND EXISTS (
               SELECT 1 FROM connect_conversation_members 
               WHERE conversation_id = c.id AND (user_id = $2::uuid OR employee_id = $2::uuid)
             )
           LIMIT 1;`,
          [user.id, otherUserId]
        );

        if (existingCheck.rowCount && existingCheck.rowCount > 0) {
          await client.query("COMMIT");
          return NextResponse.json({
            success: true,
            conversation: existingCheck.rows[0],
            isExisting: true,
          });
        }
      }

      // Create new conversation
      const insertConvQuery = `
        INSERT INTO connect_conversations (type, name, description, avatar_url, created_by_id, is_archived)
        VALUES ($1, $2, $3, $4, $5::uuid, false)
        RETURNING *;
      `;
      const convRes = await client.query(insertConvQuery, [
        convType,
        name || "Direct Message",
        description || null,
        avatarUrl || null,
        user.id,
      ]);
      const newConv = convRes.rows[0];

      // Add the creator as ADMIN member
      await client.query(
        `INSERT INTO connect_conversation_members (conversation_id, user_id, role)
         VALUES ($1, $2::uuid, 'ADMIN')
         ON CONFLICT (conversation_id, user_id) DO NOTHING;`,
        [newConv.id, user.id]
      );

      // Add other invited members
      if (Array.isArray(memberUserIds) && memberUserIds.length > 0) {
        for (const uid of memberUserIds) {
          const safeUid = ensureValidUuid(uid);
          if (safeUid !== user.id) {
            await client.query(
              `INSERT INTO connect_conversation_members (conversation_id, user_id, role)
               VALUES ($1, $2::uuid, 'MEMBER')
               ON CONFLICT (conversation_id, user_id) DO NOTHING;`,
              [newConv.id, safeUid]
            );
          }
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
