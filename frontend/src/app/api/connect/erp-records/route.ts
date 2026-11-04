import { NextResponse } from "next/server";
import { connectRoute } from "@/lib/connect/route";
import { getConnectPool } from "@/lib/connect/db";

async function handleGET() {
  try {
    const pool = getConnectPool();

    // 1. Fetch real Purchase Orders
    const poQuery = `
      SELECT 
        po.id,
        COALESCE(po.order_number, 'PO-' || SUBSTRING(po.id::text, 1, 8)) AS code,
        'Purchase Order • BDT ' || COALESCE(po.total_amount::text, '0.00') AS title,
        'Status: ' || COALESCE(po.status, 'Draft') AS subtitle,
        '৳ ' || COALESCE(po.total_amount::text, '0.00') AS amount,
        COALESCE(po.status, 'Pending') AS status,
        '/purchase/orders' AS link
      FROM purchase_orders po
      ORDER BY po.created_at DESC
      LIMIT 10;
    `;
    const poRes = await pool.query(poQuery);

    // 2. Fetch real Purchase Requisitions
    const reqQuery = `
      SELECT 
        pr.id,
        COALESCE(pr.requisition_number, 'REQ-' || SUBSTRING(pr.id::text, 1, 8)) AS code,
        'Requisition • ' || COALESCE(pr.title, 'Materials Requisition') AS title,
        'Required by Department: ' || COALESCE(pr.department, 'Procurement') AS subtitle,
        '৳ ' || COALESCE(pr.estimated_total::text, '0.00') AS amount,
        COALESCE(pr.status, 'Submitted') AS status,
        '/purchase/requisitions' AS link
      FROM purchase_requisitions pr
      ORDER BY pr.created_at DESC
      LIMIT 10;
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
    } catch {
      // Requisitions table column names might vary slightly, fallback safely
    }

    const records = [
      ...poRes.rows.map((r) => ({ ...r, type: "PURCHASE_ORDER" })),
      ...reqRows.map((r) => ({ ...r, type: "REQUISITION" })),
    ];

    return NextResponse.json({ success: true, records });
  } catch (error) {
    console.error("Error fetching ERP records:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch ERP records" }, { status: 500 });
  }
}


export const GET = connectRoute("employees:read", handleGET);
