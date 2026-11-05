import { NextResponse } from "next/server";
import { connectRoute } from "@/lib/connect/route";
import { getConnectPool } from "@/lib/connect/db";
import { getConnectAuthUser, ensureValidUuid } from "@/lib/connect/auth";
import { getPusherServer } from "@/lib/connect/pusher-server";

export async function GET(req: Request) {
  try {
    const user = await getConnectAuthUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const pool = getConnectPool();

    // Resolve current user's employee record if any
    const empRes = await pool.query(
      `SELECT id FROM employees WHERE "userId" = $1::uuid LIMIT 1`,
      [user.id]
    );
    const userEmpId = empRes.rowCount && empRes.rowCount > 0 ? empRes.rows[0].id : user.id;

    const query = `
      SELECT 
        c.id,
        c.type,
        CASE 
          WHEN c.type = 'DIRECT' THEN COALESCE(
            (
              SELECT COALESCE(u.name, e.name)
              FROM connect_conversation_members other_cm
              LEFT JOIN users u ON u.id = other_cm.user_id
              LEFT JOIN employees e ON (e.id = other_cm.employee_id OR e."userId" = other_cm.user_id)
              WHERE other_cm.conversation_id = c.id
                AND (other_cm.user_id IS NULL OR (other_cm.user_id != $1::uuid AND other_cm.user_id != $2::uuid))
                AND (other_cm.employee_id IS NULL OR (other_cm.employee_id != $1::uuid AND other_cm.employee_id != $2::uuid))
              LIMIT 1
            ),
            c.name
          )
          ELSE c.name
        END AS name,
        CASE 
          WHEN c.type = 'DIRECT' THEN (
            SELECT COALESCE(other_cm.user_id::text, other_cm.employee_id::text)
            FROM connect_conversation_members other_cm
            WHERE other_cm.conversation_id = c.id
              AND (other_cm.user_id IS NULL OR (other_cm.user_id != $1::uuid AND other_cm.user_id != $2::uuid))
              AND (other_cm.employee_id IS NULL OR (other_cm.employee_id != $1::uuid AND other_cm.employee_id != $2::uuid))
            LIMIT 1
          )
          ELSE NULL
        END AS "peerId",
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
        ) AS "memberCount",
        COALESCE(
          (
            SELECT COUNT(*)::int
            FROM connect_messages unread_m
            WHERE unread_m.conversation_id = c.id
              AND unread_m.sender_id != $1::uuid
              AND unread_m.sender_id != $2::uuid
              AND (
                cm.last_read_message_id IS NULL
                OR unread_m.created_at > (
                  SELECT COALESCE(read_m.created_at, '1970-01-01'::timestamp)
                  FROM connect_messages read_m
                  WHERE read_m.id = cm.last_read_message_id
                )
              )
          ),
          0
        ) AS "unreadCount"
      FROM connect_conversations c
      LEFT JOIN connect_conversation_members cm 
        ON cm.conversation_id = c.id 
        AND (cm.user_id = $1::uuid OR cm.employee_id = $1::uuid OR cm.user_id = $2::uuid OR cm.employee_id = $2::uuid)
        AND cm.left_at IS NULL
      WHERE c.is_archived = false
        AND (
          -- User is an active member
          cm.id IS NOT NULL
          -- OR user created it
          OR c.created_by_id = $1::uuid
          OR c.created_by_id = $2::uuid
          -- OR public general group channels
          OR (c.type = 'GROUP' AND c.name ILIKE '%general%')
        )
      ORDER BY c.created_at DESC;
    `;
    const result = await pool.query(query, [user.id, userEmpId]);
    return NextResponse.json({ success: true, conversations: result.rows });
  } catch (error) {
    console.error("Error fetching connect conversations:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch conversations" }, { status: 500 });
  }
}

async function handlePOST(req: Request) {
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

      // Current user employee record lookup
      const myInfoRes = await client.query(
        `SELECT id as emp_id FROM employees WHERE "userId" = $1::uuid LIMIT 1`,
        [user.id]
      );
      const myEmpId = myInfoRes.rowCount && myInfoRes.rowCount > 0 ? myInfoRes.rows[0].emp_id : null;

      // For 1-to-1 DIRECT conversations, check if an existing chat between these 2 users already exists
      if (convType === "DIRECT" && Array.isArray(memberUserIds) && memberUserIds.length > 0) {
        const targetRawId = memberUserIds.find((uid: string) => uid !== user.id) || memberUserIds[0];
        const safeTargetId = ensureValidUuid(targetRawId);

        // Resolve other party's employee and user IDs
        const otherInfoRes = await client.query(
          `SELECT e.id as emp_id, e."userId" as user_id, e.name 
           FROM employees e 
           WHERE e.id = $1::uuid OR e."userId" = $1::uuid
           UNION
           SELECT null as emp_id, u.id as user_id, u.name 
           FROM users u 
           WHERE u.id = $1::uuid
           LIMIT 1`,
          [safeTargetId]
        );

        const otherUserId = otherInfoRes.rows[0]?.user_id || safeTargetId;
        const otherEmpId = otherInfoRes.rows[0]?.emp_id || null;
        const otherName = otherInfoRes.rows[0]?.name || name;

        const existingCheck = await client.query(
          `SELECT c.id, c.name, c.type, c.created_at AS "createdAt"
           FROM connect_conversations c
           WHERE c.type = 'DIRECT' AND c.is_archived = false
             AND EXISTS (
               SELECT 1 FROM connect_conversation_members 
               WHERE conversation_id = c.id 
                 AND (user_id = $1::uuid OR employee_id = $1::uuid OR (user_id = $2::uuid AND $2 IS NOT NULL) OR (employee_id = $2::uuid AND $2 IS NOT NULL))
             )
             AND EXISTS (
               SELECT 1 FROM connect_conversation_members 
               WHERE conversation_id = c.id 
                 AND (user_id = $3::uuid OR employee_id = $3::uuid OR (user_id = $4::uuid AND $4 IS NOT NULL) OR (employee_id = $4::uuid AND $4 IS NOT NULL))
             )
           LIMIT 1;`,
          [user.id, myEmpId, otherUserId, otherEmpId]
        );

        if (existingCheck.rowCount && existingCheck.rowCount > 0) {
          await client.query("COMMIT");
          return NextResponse.json({
            success: true,
            conversation: existingCheck.rows[0],
            isExisting: true,
          });
        }

        // Create new direct conversation
        const insertConvQuery = `
          INSERT INTO connect_conversations (type, name, description, avatar_url, created_by_id, is_archived)
          VALUES ($1, $2, $3, $4, $5::uuid, false)
          RETURNING *;
        `;
        const convRes = await client.query(insertConvQuery, [
          convType,
          otherName || name || "Direct Message",
          description || null,
          avatarUrl || null,
          user.id,
        ]);
        const newConv = convRes.rows[0];

        // Add creator
        await client.query(
          `INSERT INTO connect_conversation_members (conversation_id, user_id, employee_id, role)
           VALUES ($1::uuid, $2::uuid, $3::uuid, 'ADMIN')
           ON CONFLICT DO NOTHING;`,
          [newConv.id, user.id, myEmpId]
        );

        // Add target
        await client.query(
          `INSERT INTO connect_conversation_members (conversation_id, user_id, employee_id, role)
           VALUES ($1::uuid, $2::uuid, $3::uuid, 'MEMBER')
           ON CONFLICT DO NOTHING;`,
          [newConv.id, otherUserId, otherEmpId]
        );

        await client.query("COMMIT");

        // Notify Pusher about new conversation
        const pusher = getPusherServer();
        if (pusher) {
          pusher.trigger("connect-global", "new-conversation", {
            conversation: newConv,
            createdById: user.id,
          }).catch(console.error);
        }

        return NextResponse.json({ success: true, conversation: newConv });
      }

      // Group conversation creation
      const insertConvQuery = `
        INSERT INTO connect_conversations (type, name, description, avatar_url, created_by_id, is_archived)
        VALUES ($1, $2, $3, $4, $5::uuid, false)
        RETURNING *;
      `;
      const convRes = await client.query(insertConvQuery, [
        convType,
        name || "Group Channel",
        description || null,
        avatarUrl || null,
        user.id,
      ]);
      const newConv = convRes.rows[0];

      // Add the creator as ADMIN member
      await client.query(
        `INSERT INTO connect_conversation_members (conversation_id, user_id, employee_id, role)
         VALUES ($1::uuid, $2::uuid, $3::uuid, 'ADMIN')
         ON CONFLICT DO NOTHING;`,
        [newConv.id, user.id, myEmpId]
      );

      // Add other invited members
      if (Array.isArray(memberUserIds) && memberUserIds.length > 0) {
        for (const uid of memberUserIds) {
          const safeUid = ensureValidUuid(uid);
          if (safeUid !== user.id) {
            const memberInfo = await client.query(
              `SELECT e.id as emp_id, e."userId" as user_id FROM employees e WHERE e.id = $1::uuid OR e."userId" = $1::uuid LIMIT 1`,
              [safeUid]
            );
            const mUserId = memberInfo.rows[0]?.user_id || safeUid;
            const mEmpId = memberInfo.rows[0]?.emp_id || null;

            await client.query(
              `INSERT INTO connect_conversation_members (conversation_id, user_id, employee_id, role)
               VALUES ($1::uuid, $2::uuid, $3::uuid, 'MEMBER')
               ON CONFLICT DO NOTHING;`,
              [newConv.id, mUserId, mEmpId]
            );
          }
        }
      }

      await client.query("COMMIT");

      const pusher = getPusherServer();
      if (pusher) {
        pusher.trigger("connect-global", "new-conversation", {
          conversation: newConv,
          createdById: user.id,
        }).catch(console.error);
      }

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


export const GET = connectRoute("employees:read", handleGET);
export const POST = connectRoute("configuration:write", handlePOST);
