import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";
import { apiHandler } from "@/lib/api/handler";
import { ensureStandardCoaHierarchy } from "@/lib/accounting/accounts-service";

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

    if (body?.action === "seedStandard") {
      await ensureStandardCoaHierarchy(prisma);
      const accounts = await prisma.account.findMany({ orderBy: [{ code: "asc" }] });
      return NextResponse.json({ success: true, data: accounts });
    }

    if (Array.isArray(body?.items)) {
      const existingRows = await prisma.account.findMany({
        select: {
          id: true,
          code: true,
          parentCode: true,
          accountType: true,
          normalBalance: true,
          description: true,
          status: true,
        },
      });
      const existingByCode = new Map(existingRows.map((a) => [a.code, a]));

      const toCreate: Array<{
        code: string;
        name: string;
        parentCode: string | null;
        accountType: string;
        accountSubtype: string;
        tierLevel: string;
        normalBalance: string;
        isGroup: boolean;
        openingBalance: number;
        currentBalance: number;
        currency: string;
        description: string | null;
        status: string;
      }> = [];
      const toUpdate: Array<{
        id: string;
        data: {
          name: string;
          parentCode: string | null;
          accountType: string;
          accountSubtype: string;
          tierLevel: string;
          normalBalance: string;
          isGroup: boolean;
          description: string | null;
          status: string;
        };
      }> = [];

      for (const row of body.items) {
        const code = String(row.code || "").trim();
        const name = String(row.name || "").trim();
        if (!code || !name) continue;
        const tierLevel = String(row.tierLevel || (row.isGroup ? "Group" : "GL"));
        const isGroup = row.isGroup !== undefined ? Boolean(row.isGroup) : tierLevel !== "GL";
        const existing = existingByCode.get(code);
        if (existing) {
          toUpdate.push({
            id: existing.id,
            data: {
              name: name.slice(0, 150),
              parentCode: row.parentCode ?? existing.parentCode,
              accountType: row.accountType || existing.accountType,
              accountSubtype: row.accountSubtype || tierLevel,
              tierLevel,
              normalBalance: row.normalBalance || existing.normalBalance,
              isGroup,
              description: row.description ?? existing.description,
              status: row.status || existing.status,
            },
          });
        } else {
          const opening = Number(row.openingBalance || 0);
          toCreate.push({
            code: code.slice(0, 50),
            name: name.slice(0, 150),
            parentCode: row.parentCode || null,
            accountType: row.accountType || "ASSET",
            accountSubtype: row.accountSubtype || tierLevel,
            tierLevel,
            normalBalance: row.normalBalance || "DEBIT",
            isGroup,
            openingBalance: opening,
            currentBalance: opening,
            currency: row.currency || "BDT",
            description: row.description || null,
            status: row.status || "ACTIVE",
          });
        }
      }

      if (toCreate.length > 0) {
        await prisma.account.createMany({ data: toCreate, skipDuplicates: true });
      }
      if (toUpdate.length > 0) {
        const CHUNK = 100;
        for (let i = 0; i < toUpdate.length; i += CHUNK) {
          const slice = toUpdate.slice(i, i + CHUNK);
          await prisma.$transaction(
            slice.map((u) => prisma.account.update({ where: { id: u.id }, data: u.data }))
          );
        }
      }

      const accounts = await prisma.account.findMany({ orderBy: [{ code: "asc" }] });
      return NextResponse.json(
        {
          success: true,
          data: accounts,
          summary: { createdCount: toCreate.length, updatedCount: toUpdate.length },
        },
        { status: 201 }
      );
    }

    const code = String(body.code || "").trim();
    const name = String(body.name || "").trim();
    if (!code || !name) {
      return NextResponse.json(
        { success: false, error: "Account code and name are required." },
        { status: 400 }
      );
    }

    const duplicate = await prisma.account.findUnique({ where: { code } });
    if (duplicate) {
      return NextResponse.json(
        { success: false, error: `Account code ${code} already exists.` },
        { status: 400 }
      );
    }

    const opening = body.openingBalance ? Number(body.openingBalance) : 0;
    const tierLevel = body.tierLevel || "GL";
    const isGroup = body.isGroup !== undefined ? Boolean(body.isGroup) : tierLevel !== "GL";

    const created = await prisma.account.create({
      data: {
        code,
        name,
        accountType: body.accountType || "ASSET",
        accountSubtype: body.accountSubtype || tierLevel,
        tierLevel,
        normalBalance: body.normalBalance || "DEBIT",
        parentCode: body.parentCode || null,
        isGroup,
        openingBalance: opening,
        currentBalance: opening,
        currency: body.currency || "BDT",
        officeId: body.officeId || null,
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

export const GET = apiHandler("accounts:read", handleGET);
export const POST = apiHandler("accounts:write", handlePOST);
