import { NextResponse } from "next/server";
import { getConnectPool } from "@/lib/connect/db";

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
    return NextResponse.json({ success: true, message: res.rows[0] });
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
    return NextResponse.json({ success: true, message: res.rows[0] });
  } catch (error) {
    console.error("Error deleting message:", error);
    return NextResponse.json({ success: false, error: "Failed to delete message" }, { status: 500 });
  }
}

