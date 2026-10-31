import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { purchaseStore } from "@/lib/purchase-store/store";
import {
  CreateRequisitionSchema,
  CreatePurchaseOrderSchema,
  CreateGoodsReceiptSchema,
  CreatePurchaseReturnSchema,
  ReportQuerySchema,
} from "@bridgeone/contracts";

async function handleGET(
  request: Request,
  { params }: { params: Promise<{ route: string[] }> }
) {
  const { route } = await params;
  const path = route.join("/");
  const searchParams = new URL(request.url).searchParams;

  try {
    // 1. MASTER DATA
    if (path === "master/offices") {
      return NextResponse.json({ success: true, data: purchaseStore.offices });
    }
    if (path === "master/warehouses") {
      const officeId = searchParams.get("officeId");
      const filtered = officeId
        ? purchaseStore.warehouses.filter((w) => w.officeId === officeId)
        : purchaseStore.warehouses;
      return NextResponse.json({ success: true, data: filtered });
    }
    if (path === "master/suppliers") {
      return NextResponse.json({ success: true, data: purchaseStore.suppliers });
    }
    if (path === "master/items") {
      return NextResponse.json({ success: true, data: purchaseStore.items });
    }
    if (path === "master/context") {
      return NextResponse.json({
        success: true,
        data: {
          company: {
            id: "comp-bridgeone-01",
            code: "BRG-TECH",
            name: "BridgeOne Technologies Ltd.",
            currency: "BDT",
          },
          user: {
            id: "usr-bridgeone-procurement-mgr",
            name: "Fuad Hossain",
            role: "PURCHASE_MANAGER",
          },
        },
      });
    }

    // 2. PURCHASE DASHBOARD & ANALYTICS
    if (path === "purchase/dashboard" || path === "purchase/analytics") {
      const analytics = purchaseStore.getDashboardAnalytics({
        fromDate: searchParams.get("fromDate") || undefined,
        toDate: searchParams.get("toDate") || undefined,
        officeId: searchParams.get("officeId") || undefined,
      });
      return NextResponse.json({ success: true, data: analytics });
    }

    // 3. REQUISITIONS
    if (path === "purchase/requisitions") {
      const list = purchaseStore.getRequisitions({
        officeId: searchParams.get("officeId") || undefined,
        warehouseId: searchParams.get("warehouseId") || undefined,
        status: searchParams.get("status") || undefined,
        search: searchParams.get("search") || undefined,
        fromDate: searchParams.get("fromDate") || undefined,
        toDate: searchParams.get("toDate") || undefined,
        requestType: searchParams.get("requestType") || undefined,
        section: searchParams.get("section") || undefined,
        buyerOfficeId: searchParams.get("buyerOfficeId") || undefined,
      });
      return NextResponse.json({
        success: true,
        data: list,
        meta: { total: list.length },
      });
    }
    if (path.startsWith("purchase/requisitions/") && route.length === 3) {
      const id = route[2];
      const item = purchaseStore.getRequisitionById(id);
      if (!item) {
        return NextResponse.json(
          { error: { message: `Requisition '${id}' not found` } },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: item });
    }

    // 4. PURCHASE ORDERS
    if (path === "purchase/orders") {
      const list = purchaseStore.getPurchaseOrders({
        officeId: searchParams.get("officeId") || undefined,
        supplierId: searchParams.get("supplierId") || undefined,
        status: searchParams.get("status") || undefined,
        search: searchParams.get("search") || undefined,
        fromDate: searchParams.get("fromDate") || undefined,
        toDate: searchParams.get("toDate") || undefined,
      });
      return NextResponse.json({
        success: true,
        data: list,
        meta: { total: list.length },
      });
    }
    if (path.startsWith("purchase/orders/") && route.length === 3) {
      const id = route[2];
      const po = purchaseStore.getPurchaseOrderById(id);
      if (!po) {
        return NextResponse.json(
          { error: { message: `Purchase Order '${id}' not found` } },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: po });
    }

    // 5. GOODS RECEIPT
    if (path === "purchase/receive") {
      const list = purchaseStore.getGoodsReceipts({
        search: searchParams.get("search") || undefined,
        status: searchParams.get("status") || undefined,
      });
      return NextResponse.json({
        success: true,
        data: list,
        meta: { total: list.length },
      });
    }
    if (path === "purchase/receive/approved-orders") {
      const list = purchaseStore.getApprovedOrdersForReceiving();
      return NextResponse.json({
        success: true,
        data: list,
        meta: { total: list.length },
      });
    }

    // 6. PURCHASE RETURNS
    if (path === "purchase/returns") {
      const list = purchaseStore.getPurchaseReturns({
        search: searchParams.get("search") || undefined,
        status: searchParams.get("status") || undefined,
      });
      return NextResponse.json({
        success: true,
        data: list,
        meta: { total: list.length },
      });
    }
    if (path === "purchase/returns/eligible-receipts") {
      const list = purchaseStore.getEligibleReceiptsForReturn();
      return NextResponse.json({
        success: true,
        data: list,
        meta: { total: list.length },
      });
    }

    // 7. SUPPLIER PAYMENTS & INVOICES
    if (path === "purchase/supplier-payments") {
      const list = purchaseStore.getSupplierPayments({
        search: searchParams.get("search") || undefined,
        status: searchParams.get("status") || undefined,
        category: searchParams.get("category") || undefined,
      });
      return NextResponse.json({
        success: true,
        data: list,
        meta: { total: list.length },
      });
    }
    if (path === "purchase/supplier-payments/invoices") {
      const list = purchaseStore.getSupplierInvoices({
        search: searchParams.get("search") || undefined,
        status: searchParams.get("status") || undefined,
        type: searchParams.get("type") || undefined,
      });
      return NextResponse.json({
        success: true,
        data: list,
        meta: { total: list.length },
      });
    }

    // 8. REPORTS
    if (path === "purchase/reports") {
      const query = ReportQuerySchema.parse({
        reportType: searchParams.get("reportType") || "REQUISITION_REPORT",
        officeId: searchParams.get("officeId") || undefined,
        supplierId: searchParams.get("supplierId") || undefined,
        fromDate: searchParams.get("fromDate") || undefined,
        toDate: searchParams.get("toDate") || undefined,
        status: searchParams.get("status") || undefined,
        isSummary: searchParams.get("isSummary") === "true",
      });
      const report = purchaseStore.generateReport(query);
      return NextResponse.json({ success: true, data: report });
    }
    if (path === "purchase/reports/export-csv") {
      const query = ReportQuerySchema.parse({
        reportType: searchParams.get("reportType") || "REQUISITION_REPORT",
        officeId: searchParams.get("officeId") || undefined,
        supplierId: searchParams.get("supplierId") || undefined,
        fromDate: searchParams.get("fromDate") || undefined,
        toDate: searchParams.get("toDate") || undefined,
        status: searchParams.get("status") || undefined,
        isSummary: searchParams.get("isSummary") === "true",
      });
      const report = purchaseStore.generateReport(query);
      const headers = report.columns.join(",");
      const rows = report.rows.map((row) =>
        report.columns
          .map((col) => {
            const val = row[col] !== undefined ? String(row[col]) : "";
            return `"${val.replace(/"/g, '""')}"`;
          })
          .join(",")
      );
      const csvContent = [headers, ...rows].join("\r\n");
      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${report.reportType.toLowerCase()}_${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json(
      { error: { message: `Route not found: ${path}` } },
      { status: 404 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err?.message || "Internal server error" } },
      { status: 500 }
    );
  }
}

async function handlePOST(
  request: Request,
  { params }: { params: Promise<{ route: string[] }> }
) {
  const { route } = await params;
  const path = route.join("/");

  try {
    const body = await request.json().catch(() => ({}));
    const actorName = "Fuad Hossain";

    // Create Requisition
    if (path === "purchase/requisitions") {
      const validated = CreateRequisitionSchema.parse(body);
      const created = purchaseStore.createRequisition(validated, actorName);
      return NextResponse.json({ success: true, data: created }, { status: 201 });
    }

    // Requisition actions
    if (route[0] === "purchase" && route[1] === "requisitions" && route.length === 4) {
      const id = route[2];
      const action = route[3];
      const comments = body?.comments || "";

      if (action === "approve") {
        const updated = purchaseStore.updateRequisitionStatus(id, "APPROVE", actorName, comments);
        return NextResponse.json({ success: true, data: updated });
      }
      if (action === "reject") {
        const updated = purchaseStore.updateRequisitionStatus(id, "REJECT", actorName, comments);
        return NextResponse.json({ success: true, data: updated });
      }
      if (action === "cancel") {
        const updated = purchaseStore.updateRequisitionStatus(id, "CANCEL", actorName, comments);
        return NextResponse.json({ success: true, data: updated });
      }
      if (action === "reverse") {
        const updated = purchaseStore.updateRequisitionStatus(
          id,
          "REVERSE",
          actorName,
          comments || "Requisition reversed to submitted status."
        );
        return NextResponse.json({ success: true, data: updated });
      }
    }

    // Create Purchase Order
    if (path === "purchase/orders") {
      const validated = CreatePurchaseOrderSchema.parse(body);
      const created = purchaseStore.createPurchaseOrder(validated, actorName);
      return NextResponse.json({ success: true, data: created }, { status: 201 });
    }

    // Create Goods Receipt
    if (path === "purchase/receive") {
      const validated = CreateGoodsReceiptSchema.parse(body);
      const created = await purchaseStore.createGoodsReceipt(validated, actorName);
      return NextResponse.json({ success: true, data: created }, { status: 201 });
    }

    // Create Purchase Return
    if (path === "purchase/returns") {
      const validated = CreatePurchaseReturnSchema.parse(body);
      const created = await purchaseStore.createPurchaseReturn(validated, actorName);
      return NextResponse.json({ success: true, data: created }, { status: 201 });
    }

    return NextResponse.json(
      { error: { message: `POST route not found: ${path}` } },
      { status: 404 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err?.message || "Internal server error" } },
      { status: 400 }
    );
  }
}

async function handlePUT(
  request: Request,
  { params }: { params: Promise<{ route: string[] }> }
) {
  const { route } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const actorName = "Fuad Hossain";

    // Update Requisition
    if (route[0] === "purchase" && route[1] === "requisitions" && route.length === 3) {
      const id = route[2];
      const updated = purchaseStore.updateRequisition(id, body, actorName);
      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json(
      { error: { message: `PUT route not found: ${route.join("/")}` } },
      { status: 404 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err?.message || "Internal server error" } },
      { status: 400 }
    );
  }
}

// Signed-in users with the purchase permission only.
export const GET = apiHandler("purchase:read", handleGET);
export const POST = apiHandler("purchase:write", handlePOST);
export const PUT = apiHandler("purchase:write", handlePUT);
