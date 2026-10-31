import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";
import { apiHandler } from "@/lib/api/handler";

async function handleGET() {
  try {
    const prisma = db();
    const accounts = await prisma.account.findMany({
      orderBy: [{ code: "asc" }],
    });
    return NextResponse.json({ success: true, data: accounts });
  } catch (error) {
    console.error("Failed to fetch Chart of Accounts:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch Chart of Accounts" },
      { status: 500 }
    );
  }
}

async function handlePOST(request: Request) {
  try {
    const body = await request.json();
    const prisma = db();

    const created = await prisma.account.create({
      data: {
        code: body.code,
        name: body.name,
        accountType: body.accountType,
        accountSubtype: body.accountSubtype || null,
        tierLevel: body.tierLevel || "GL",
        normalBalance: body.normalBalance || "DEBIT",
        parentCode: body.parentCode || null,
        isGroup: Boolean(body.isGroup),
        openingBalance: body.openingBalance ? Number(body.openingBalance) : 0,
        currentBalance: body.openingBalance ? Number(body.openingBalance) : 0,
        description: body.description || null,
        status: body.status || "ACTIVE",
      },
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error("Failed to create Account:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create Account" },
      { status: 500 }
    );
  }
}

// Signed-in users with the accounts permission only.
export const GET = apiHandler("accounts:read", handleGET);
export const POST = apiHandler("accounts:write", handlePOST);
