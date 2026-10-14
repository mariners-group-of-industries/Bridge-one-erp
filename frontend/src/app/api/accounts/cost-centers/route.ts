import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";

export async function GET() {
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prisma = db();

    const created = await prisma.costCenter.create({
      data: {
        code: body.code,
        name: body.name,
        type: body.type || "DEPARTMENT",
        officeId: body.officeId || null,
        officeName: body.officeName || null,
        description: body.description || null,
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
