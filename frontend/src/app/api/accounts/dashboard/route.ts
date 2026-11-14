import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";
import { apiHandler } from "@/lib/api/handler";
import { computeAccountsDashboard } from "@/lib/accounting/accounts-service";

async function handleGET(request: Request) {
  try {
    const url = new URL(request.url);
    const officeId = url.searchParams.get("officeId");
    const fromDate = url.searchParams.get("fromDate");
    const toDate = url.searchParams.get("toDate");
    const yearParam = url.searchParams.get("year");
    const year = yearParam ? Number(yearParam) : undefined;

    const prisma = db();
    const data = await computeAccountsDashboard(prisma, {
      officeId,
      fromDate,
      toDate,
      year: year && Number.isFinite(year) ? year : undefined,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Failed to compute accounts dashboard:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load accounts dashboard" },
      { status: 500 }
    );
  }
}

export const GET = apiHandler("accounts:read", handleGET);

