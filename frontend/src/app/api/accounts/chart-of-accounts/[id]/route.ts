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

    const existing = await prisma.account.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Account not found" }, { status: 404 });
    }

    if (body.code && body.code !== existing.code) {
      const conflict = await prisma.account.findUnique({ where: { code: body.code } });
      if (conflict) {
        return NextResponse.json(
          { success: false, error: `Account code ${body.code} already exists.` },
          { status: 400 }
        );
      }
    }

    const nextTier = body.tierLevel ?? existing.tierLevel ?? "GL";
    const nextIsGroup =
      body.isGroup !== undefined ? Boolean(body.isGroup) : nextTier !== "GL";

    let nextCurrentBalance = Number(existing.currentBalance);
    let nextOpeningBalance = Number(existing.openingBalance);
    if (body.openingBalance !== undefined) {
      const delta = Number(body.openingBalance) - nextOpeningBalance;
      nextOpeningBalance = Number(body.openingBalance);
      nextCurrentBalance = Math.round((nextCurrentBalance + delta) * 100) / 100;
    }

    const updated = await prisma.account.update({
      where: { id },
      data: {
        code: body.code !== undefined ? String(body.code).trim() : existing.code,
        name: body.name !== undefined ? String(body.name).trim() : existing.name,
        parentCode: body.parentCode !== undefined ? body.parentCode || null : existing.parentCode,
        accountType: body.accountType ?? existing.accountType,
        accountSubtype: body.accountSubtype ?? nextTier,
        tierLevel: nextTier,
        normalBalance: body.normalBalance ?? existing.normalBalance,
        openingBalance: nextOpeningBalance,
        currentBalance: nextCurrentBalance,
        currency: body.currency ?? existing.currency,
        isGroup: nextIsGroup,
        status: body.status ?? existing.status,
        description: body.description !== undefined ? body.description : existing.description,
      },
    });

    // Propagate code rename to child parentCode & CoaPermissions if code changed
    if (body.code && body.code !== existing.code) {
      await prisma.account.updateMany({
        where: { parentCode: existing.code },
        data: { parentCode: body.code },
      });
      await prisma.coaPermission.updateMany({
        where: { accountId: id },
        data: { accountHeadCode: body.code, accountHeadName: updated.name },
      });
    } else if (body.name && body.name !== existing.name) {
      await prisma.coaPermission.updateMany({
        where: { accountId: id },
        data: { accountHeadName: updated.name },
      });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Failed to update Account:", error);
    return NextResponse.json({ success: false, error: "Failed to update Account" }, { status: 500 });
  }
}

async function handleDELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const prisma = db();

    const existing = await prisma.account.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Account not found" }, { status: 404 });
    }

    const [childCount, voucherLineCount, postingCount] = await Promise.all([
      prisma.account.count({ where: { parentCode: existing.code } }),
      prisma.journalVoucherLine.count({ where: { accountId: id } }),
      prisma.postingAccount.count({ where: { accountId: id } }),
    ]);

    if (childCount > 0) {
      return NextResponse.json(
        { success: false, error: "Cannot delete an account that still has child accounts." },
        { status: 400 }
      );
    }
    if (voucherLineCount > 0 || postingCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Account has posted ledger entries or posting setup links; deactivate it instead.",
        },
        { status: 400 }
      );
    }

    await prisma.coaPermission.deleteMany({ where: { accountId: id } });
    await prisma.account.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete Account:", error);
    return NextResponse.json({ success: false, error: "Failed to delete Account" }, { status: 500 });
  }
}

export const PATCH = apiHandler("accounts:write", handlePATCH);
export const PUT = apiHandler("accounts:write", handlePATCH);
export const DELETE = apiHandler("accounts:write", handleDELETE);

