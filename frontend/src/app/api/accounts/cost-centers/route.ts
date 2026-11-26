import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";
import { apiHandler } from "@/lib/api/handler";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function handleGET() {
  try {
    const prisma = db();
    const centers = await prisma.costCenter.findMany({
      orderBy: [{ code: "asc" }],
    });
    return NextResponse.json({ success: true, data: centers });
  } catch (error) {
    console.error("Failed to fetch Cost Centers:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch Cost Centers" },
      { status: 500 }
    );
  }
}

async function handlePOST(request: Request) {
  try {
    const body = await request.json();
    const prisma = db();
    const code = String(body.code ?? "").trim();
    const name = String(body.name ?? "").trim();
    if (!code || !name) {
      return NextResponse.json({ success: false, error: "Enter the center code and name." }, { status: 400 });
    }
    if (!UUID.test(String(body.officeId ?? ""))) {
      return NextResponse.json({ success: false, error: "Select the office." }, { status: 400 });
    }
    if (await prisma.costCenter.findUnique({ where: { code }, select: { id: true } })) {
      return NextResponse.json({ success: false, error: `Center code ${code} is already used.` }, { status: 409 });
    }
    const effectiveDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.effectiveDate ?? "")) ? new Date(`${body.effectiveDate}T00:00:00.000Z`) : null;

    const created = await prisma.costCenter.create({
      data: {
        code,
        name,
        type: body.type || "DEPARTMENT",
        officeId: body.officeId,
        officeName: body.officeName || null,
        description: body.description || null,
        effectiveDate,
        status: body.status || "ACTIVE",
      },
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error("Failed to create Cost Center:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create Cost Center" },
      { status: 500 }
    );
  }
}

// Signed-in users with the accounts permission only.
export const GET = apiHandler("accounts:read", handleGET);
export const POST = apiHandler("accounts:write", handlePOST);
