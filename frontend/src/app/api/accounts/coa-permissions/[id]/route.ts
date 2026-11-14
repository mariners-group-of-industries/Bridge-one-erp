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

    const existing = await prisma.coaPermission.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Permission not found" }, { status: 404 });
    }

    const updated = await prisma.coaPermission.update({
      where: { id },
      data: {
        status: body.status ?? (existing.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"),
      },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Failed to update COA permission:", error);
    return NextResponse.json({ success: false, error: "Failed to update COA permission" }, { status: 500 });
  }
}

async function handleDELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const prisma = db();
    await prisma.coaPermission.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete COA permission:", error);
    return NextResponse.json({ success: false, error: "Failed to delete COA permission" }, { status: 500 });
  }
}

export const PATCH = apiHandler("accounts:write", handlePATCH);
export const DELETE = apiHandler("accounts:write", handleDELETE);

