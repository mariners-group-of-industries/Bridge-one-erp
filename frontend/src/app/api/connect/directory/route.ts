import { NextResponse } from "next/server";
import { connectRoute } from "@/lib/connect/route";
import { getConnectPool } from "@/lib/connect/db";
import { getConnectAuthUser } from "@/lib/connect/auth";

async function handleGET(req: Request) {
  try {
    const user = await getConnectAuthUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const department = searchParams.get("department") || "";

    const pool = getConnectPool();
    let query = `
      SELECT 
        e.id,
        e.name,
        COALESCE(e.designation, 'Staff Member') AS designation,
        COALESCE(e.department, 'General') AS department,
        e."employeeCode" AS "employeeCode",
        COALESCE(e.mobile, e."officialContact", '+880 1700-000000') AS phone,
        COALESCE(e.email, 'employee@marinozz.com') AS email,
        COALESCE(o.name, 'Head Office') AS "officeName",
        e."isActive" AS "isActive"
      FROM employees e
      LEFT JOIN offices o ON o.id = e."officeId"
      WHERE 1=1
    `;

    const values: (string | boolean | number)[] = [];

    if (search) {
      values.push(`%${search}%`);
      query += ` AND (e.name ILIKE $${values.length} OR e.designation ILIKE $${values.length} OR e.department ILIKE $${values.length})`;
    }

    if (department && department !== "All") {
      values.push(department);
      query += ` AND e.department = $${values.length}`;
    }

    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 500;

    query += ` ORDER BY e.name ASC`;
    if (limit > 0) {
      values.push(limit);
      query += ` LIMIT $${values.length};`;
    } else {
      query += `;`;
    }

    const res = await pool.query(query, values);
    return NextResponse.json({ success: true, employees: res.rows });
  } catch (error) {
    console.error("Error fetching employee directory:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch directory" }, { status: 500 });
  }
}


export const GET = connectRoute("employees:read", handleGET);
