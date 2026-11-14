import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";
import { apiHandler } from "@/lib/api/handler";
import { isoDateOrNull, isUuid } from "@/lib/accounting/ids";

async function handlePATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const prisma = db();
    if (!isUuid(id) || !(await prisma.costCenter.findUnique({ where: { id }, select: { id: true } }))) {
      return NextResponse.json({ success: false, error: "Cost center not found." }, { status: 404 });
    }
    const code = body.code !== undefined ? String(body.code).trim() : undefined;
    const name = body.name !== undefined ? String(body.name).trim() : undefined;
    if (code === "" || name === "") {
      return NextResponse.json({ success: false, error: "Enter the center code and name." }, { status: 400 });
    }
    if (body.officeId !== undefined && !isUuid(body.officeId)) {
      return NextResponse.json({ success: false, error: "Select the office." }, { status: 400 });
    }
    if (code && (await prisma.costCenter.findFirst({ where: { code, id: { not: id } }, select: { id: true } }))) {
      return NextResponse.json({ success: false, error: `Center code ${code} is already used.` }, { status: 409 });
    }
    const updated = await prisma.costCenter.update({
      where: { id },
      data: {
        code,
        name,
        type: body.type ?? undefined,
        officeId: body.officeId ?? undefined,
        officeName: body.officeName ?? undefined,
        description: body.description ?? undefined,
        effectiveDate: body.effectiveDate !== undefined ? isoDateOrNull(body.effectiveDate) : undefined,
        status: body.status === "ACTIVE" || body.status === "INACTIVE" ? body.status : undefined,
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

