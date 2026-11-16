import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";
import { apiHandler } from "@/lib/api/handler";
import { computeAccountsDashboard } from "@/lib/accounting/accounts-service";
import type { Actor } from "@/lib/auth/actor";
import { scopedBusinessUnitIds } from "@/features/sales/lib/scope";
import { isPlaceInOrgScope, resolvePurchaseOrgScope } from "@/lib/purchase-store/governance";

async function handleGET(request: Request, _context: unknown, actor: Actor) {
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

    // The Office filter lists the offices of the user's companies and Org Access (Configuration).
    const [unitIds, orgScope, placed] = await Promise.all([
      scopedBusinessUnitIds(actor),
      resolvePurchaseOrgScope(actor),
      prisma.office.findMany({ select: { id: true, businessUnitId: true } }),
    ]);
    const allowed = new Set(
      placed.filter((o) => unitIds.includes(o.businessUnitId) && isPlaceInOrgScope(orgScope, { officeId: o.id, businessUnitId: o.businessUnitId })).map((o) => o.id),
    );
    data.filters.offices = data.filters.offices.filter((o) => allowed.has(o.id));

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

