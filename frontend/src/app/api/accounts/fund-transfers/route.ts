import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";
import { apiHandler } from "@/lib/api/handler";

async function handleGET() {
  try {
    const prisma = db();
    const transfers = await prisma.fundTransfer.findMany({
      orderBy: [{ requestDate: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ success: true, data: transfers });
  } catch (error) {
    console.error("Failed to fetch fund transfers:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch fund transfers" }, { status: 500 });
  }
}

async function handlePOST(request: Request) {
  try {
    const body = await request.json();
    const prisma = db();

    const requestedAmount = Number(body.requestedAmount || 0);
    if (!requestedAmount || requestedAmount <= 0) {
      return NextResponse.json({ success: false, error: "Transfer amount must be positive." }, { status: 400 });
    }

    const num = `FT-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const reqDate = body.requestDate ? new Date(body.requestDate) : new Date();
    const expDate = body.expectedDate ? new Date(body.expectedDate) : null;

    const created = await prisma.fundTransfer.create({
      data: {
        transferNumber: num,
        requestCode: body.requestCode || `REQ-${num}`,
        requestDate: Number.isNaN(reqDate.getTime()) ? new Date() : reqDate,
        expectedDate: expDate && !Number.isNaN(expDate.getTime()) ? expDate : null,
        fromOfficeId: body.fromOfficeId || null,
        fromOfficeName: body.fromOfficeName || "Corporate HO",
        toOfficeId: body.toOfficeId || null,
        toOfficeName: body.toOfficeName || "Branch Office",
        fromAccountId: body.fromAccountId || null,
        fromAccountName: body.fromAccountName || "Cash At Bank",
        toAccountId: body.toAccountId || null,
        toAccountName: body.toAccountName || "Cash In Hand",
        requestedAmount,
        approvedAmount: Number(body.approvedAmount || 0),
        transferredAmount: Number(body.transferredAmount || 0),
        receivedAmount: 0,
        responsiblePerson: body.responsiblePerson || "Accounts Officer",
        purpose: body.purpose || "Inter-office fund transfer",
        status: body.status || "SUBMITTED",
      },
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error("Failed to create fund transfer:", error);
    return NextResponse.json({ success: false, error: "Failed to create fund transfer" }, { status: 500 });
  }
}

export const GET = apiHandler("accounts:read", handleGET);
export const POST = apiHandler("accounts:write", handlePOST);

