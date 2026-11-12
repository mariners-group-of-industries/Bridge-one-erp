import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";
import { apiHandler } from "@/lib/api/handler";

async function handlePATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const prisma = db();
    const updated = await prisma.costCenter.update({
      where: { id },
      data: {
        code: body.code ?? undefined,
        name: body.name ?? undefined,
        type: body.type ?? undefined,
        officeId: body.officeId ?? undefined,
        officeName: body.officeName ?? undefined,
        description: body.description ?? undefined,
        status: body.status ?? undefined,
      },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Failed to update cost center:", error);
    return NextResponse.json({ success: false, error: "Failed to update cost center" }, { status: 500 });
  }
}

async function handleDELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const prisma = db();
    await prisma.costCenter.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete cost center:", error);
    return NextResponse.json({ success: false, error: "Failed to delete cost center" }, { status: 500 });
  }
}

export const PATCH = apiHandler("accounts:write", handlePATCH);
export const DELETE = apiHandler("accounts:write", handleDELETE);

