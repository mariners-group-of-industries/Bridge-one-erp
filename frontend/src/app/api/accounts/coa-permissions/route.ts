import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";
import { apiHandler } from "@/lib/api/handler";

async function handleGET(request: Request) {
  try {
    const url = new URL(request.url);
    const employee = url.searchParams.get("employee")?.trim();
    const voucherType = url.searchParams.get("voucherType")?.trim();
    const accountHeadCode = url.searchParams.get("accountHeadCode")?.trim();

    const where: Record<string, unknown> = {};
    if (voucherType && voucherType !== "ALL") where.voucherType = voucherType;
    if (accountHeadCode && accountHeadCode !== "ALL") where.accountHeadCode = accountHeadCode;
    if (employee) {
      where.OR = [
        { employeeName: { contains: employee, mode: "insensitive" } },
        { employeeId: { contains: employee, mode: "insensitive" } },
      ];
    }

    const prisma = db();
    const items = await prisma.coaPermission.findMany({
      where,
      orderBy: [{ employeeName: "asc" }, { voucherType: "asc" }, { accountHeadCode: "asc" }],
    });

    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.error("Failed to fetch COA permissions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch COA permissions" },
      { status: 500 }
    );
  }
}

async function handlePOST(request: Request) {
  try {
    const body = await request.json();
    const prisma = db();
    const rawItems = Array.isArray(body?.items) ? body.items : [body];

    const saved = [];
    for (const item of rawItems) {
      const employeeId = String(item.employeeId || "").trim();
      const employeeName = String(item.employeeName || "").trim();
      const voucherType = String(item.voucherType || "").trim();
      const accountHeadCode = String(item.accountHeadCode || "").trim();
      if (!employeeName || !voucherType || !accountHeadCode) continue;

      const empCode = employeeId || employeeName;
      const [empRecord, accRecord] = await Promise.all([
        item.employeeUuid
          ? prisma.employee.findUnique({ where: { id: item.employeeUuid }, select: { id: true, employeeCode: true, name: true } })
          : prisma.employee.findFirst({
              where: { OR: [{ employeeCode: empCode }, { name: employeeName }] },
              select: { id: true, employeeCode: true, name: true },
            }),
        item.accountId
          ? prisma.account.findUnique({ where: { id: item.accountId }, select: { id: true, code: true, name: true } })
          : prisma.account.findUnique({ where: { code: accountHeadCode }, select: { id: true, code: true, name: true } }),
      ]);

      const resolvedEmpId = empRecord?.employeeCode || empCode;
      const resolvedEmpName = empRecord?.name || employeeName;
      const resolvedAccName = accRecord?.name || String(item.accountHeadName || accountHeadCode);

      const record = await prisma.coaPermission.upsert({
        where: {
          employeeId_voucherType_accountHeadCode: {
            employeeId: resolvedEmpId,
            voucherType,
            accountHeadCode,
          },
        },
        update: {
          employeeUuid: empRecord?.id ?? null,
          employeeName: resolvedEmpName,
          accountId: accRecord?.id ?? null,
          accountHeadName: resolvedAccName,
          status: item.status || "ACTIVE",
        },
        create: {
          employeeUuid: empRecord?.id ?? null,
          employeeId: resolvedEmpId,
          employeeName: resolvedEmpName,
          voucherType,
          accountId: accRecord?.id ?? null,
          accountHeadCode,
          accountHeadName: resolvedAccName,
          status: item.status || "ACTIVE",
        },
      });
      saved.push(record);
    }

    if (saved.length === 0) {
      return NextResponse.json(
        { success: false, error: "Please select Employee, Voucher Type and Account Head." },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: saved.length === 1 ? saved[0] : saved }, { status: 201 });
  } catch (error) {
    console.error("Failed to create COA permission:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save COA permission" },
      { status: 500 }
    );
  }
}

export const GET = apiHandler("accounts:read", handleGET);
export const POST = apiHandler("accounts:write", handlePOST);

