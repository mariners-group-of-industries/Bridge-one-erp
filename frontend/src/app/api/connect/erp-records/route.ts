import { NextResponse } from "next/server";
import { connectRoute } from "@/lib/connect/route";
import { getConnectPool } from "@/lib/connect/db";
import { getConnectAuthUser } from "@/lib/connect/auth";

export async function GET(req: Request) {
  try {
    const user = await getConnectAuthUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const pool = getConnectPool();

    // 1. Fetch real Purchase Orders from Neon DB
    const poQuery = `
      SELECT 
        po.id,
        COALESCE(po."number", 'PO-' || SUBSTRING(po.id::text, 1, 8)) AS code,
        'Purchase Order • BDT ' || COALESCE(po."totalAmount"::text, '0.00') AS title,
        'Status: ' || COALESCE(po.status::text, 'Pending') || ' • Created by: ' || COALESCE(po."createdBy", 'System') AS subtitle,
        '৳ ' || COALESCE(po."totalAmount"::text, '0.00') AS amount,
        COALESCE(po.status::text, 'Pending') AS status,
        '/purchase/orders' AS link
      FROM purchase_orders po
      ORDER BY po."createdAt" DESC
      LIMIT 20;
    `;
    let poRows: Array<{
      id: string;
      code: string;
      title: string;
      subtitle: string;
      amount: string;
      status: string;
      link: string;
    }> = [];
    try {
      const poRes = await pool.query(poQuery);
      poRows = poRes.rows;
    } catch (err) {
      console.warn("Could not query purchase_orders:", err);
    }

    // 2. Fetch real Purchase Requisitions from Neon DB
    const reqQuery = `
      SELECT 
        pr.id,
        COALESCE(pr."number", 'REQ-' || SUBSTRING(pr.id::text, 1, 8)) AS code,
        'Requisition • ' || COALESCE(pr.department, 'Procurement') AS title,
        'Status: ' || COALESCE(pr.status::text, 'Submitted') || ' • Requested by: ' || COALESCE(pr."requestedBy", 'User') AS subtitle,
        '৳ ' || COALESCE(pr."totalEstimated"::text, '0.00') AS amount,
        COALESCE(pr.status::text, 'Submitted') AS status,
        '/purchase/requisitions' AS link
      FROM purchase_requisitions pr
      ORDER BY pr."createdAt" DESC
      LIMIT 20;
    `;
    let reqRows: Array<{
      id: string;
      code: string;
      title: string;
      subtitle: string;
      amount: string;
      status: string;
      link: string;
    }> = [];
    try {
      const reqRes = await pool.query(reqQuery);
      reqRows = reqRes.rows;
    } catch (err) {
      console.warn("Could not query purchase_requisitions:", err);
    }

    const records = [
      ...poRows.map((r) => ({ ...r, type: "PURCHASE_ORDER" })),
      ...reqRows.map((r) => ({ ...r, type: "REQUISITION" })),
    ];

    return NextResponse.json({ success: true, records });
  } catch (error) {
    console.error("Error fetching ERP records:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch ERP records" }, { status: 500 });
  }
}


export const GET = connectRoute("employees:read", handleGET);
