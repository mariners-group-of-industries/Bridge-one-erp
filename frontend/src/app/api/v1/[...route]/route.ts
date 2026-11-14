import { NextResponse } from "next/server";
import { AppError } from "@/lib/api/errors";
import { apiHandler } from "@/lib/api/handler";
import type { Actor } from "@/lib/auth/actor";
import { purchaseStore } from "@/lib/purchase-store/store";
import {
  approvePendingSupplierBills,
  approveSupplierBill,
  createSupplierBill,
  listPaymentHistory,
  listSupplierAdvances,
  listSupplierBills,
} from "@/lib/purchase-store/payables";
import {
  CreateRequisitionSchema,
  CreatePurchaseOrderSchema,
  CreateGoodsReceiptSchema,
  CreatePurchaseReturnSchema,
  ReportQuerySchema,
} from "@bridgeone/contracts";

/** Client-facing error: business-rule messages keep their status; Zod issues are made readable. */
function errorResponse(err: unknown, fallbackStatus: number) {
  if (err instanceof AppError) return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
  // Contracts are validated with their own zod copy, so match the error by shape.
  const issues = (err as { name?: string; issues?: { path?: (string | number)[]; message?: string }[] })?.issues;
  if ((err as Error)?.name === "ZodError" && Array.isArray(issues)) {
    const issue = issues[0];
    const where = issue?.path?.length ? `${issue.path.join(".")}: ` : "";
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: `${where}${issue?.message ?? "Invalid input"}` } }, { status: 400 });
  }
  const message = err instanceof Error && err.message ? err.message : "Internal server error";
  return NextResponse.json({ error: { message } }, { status: fallbackStatus });
}

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
      const data = await purchaseStore.getOffices();
      return NextResponse.json({ success: true, data });
    }
    if (path === "master/warehouses") {
      const officeId = searchParams.get("officeId") || undefined;
      const data = await purchaseStore.getWarehouses(officeId);
      return NextResponse.json({ success: true, data });
    }
    if (path === "master/suppliers") {
      const data = await purchaseStore.getSuppliers();
      return NextResponse.json({ success: true, data });
    }
    if (path === "master/items") {
      const data = await purchaseStore.getItems();
      return NextResponse.json({ success: true, data });
    }
    if (path === "master/context") {
      const data = await purchaseStore.getContext();
      return NextResponse.json({ success: true, data });
    }

    // 2. PURCHASE DASHBOARD & ANALYTICS
    if (path === "purchase/dashboard" || path === "purchase/analytics") {
      const analytics = await purchaseStore.getDashboardAnalytics({
        fromDate: searchParams.get("fromDate") || undefined,
        toDate: searchParams.get("toDate") || undefined,
        officeId: searchParams.get("officeId") || undefined,
      });
      return NextResponse.json({ success: true, data: analytics });
    }

    // 3. REQUISITIONS
    if (path === "purchase/requisitions") {
      const list = await purchaseStore.getRequisitions({
        officeId: searchParams.get("officeId") || undefined,
        warehouseId: searchParams.get("warehouseId") || undefined,
        status: searchParams.get("status") || undefined,
        search: searchParams.get("search") || undefined,
        fromDate: searchParams.get("fromDate") || undefined,
        toDate: searchParams.get("toDate") || undefined,
        requestType: searchParams.get("requestType") || undefined,
        section: searchParams.get("section") || undefined,
      });
      return NextResponse.json({
        success: true,
        data: list,
        meta: { total: list.length },
      });
    }
    if (path === "purchase/requisitions/summary") {
      const data = await purchaseStore.getRequisitionSummary({
        officeId: searchParams.get("officeId") || undefined,
        fromDate: searchParams.get("fromDate") || undefined,
        toDate: searchParams.get("toDate") || undefined,
      });
      return NextResponse.json({ success: true, data, meta: { total: data.length } });
    }
    if (path.startsWith("purchase/requisitions/") && route.length === 3) {
      const id = route[2];
      const item = await purchaseStore.getRequisitionById(id);
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
      const list = await purchaseStore.getPurchaseOrders({
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
      const po = await purchaseStore.getPurchaseOrderById(id);
      if (!po) {
        return NextResponse.json(
          { error: { message: `Purchase Order '${id}' not found` } },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: po });
    }

    // 5. GOODS RECEIPT (supports both /purchase/receive and /purchase/receipts)
    if (path === "purchase/receive" || path === "purchase/receipts") {
      const list = await purchaseStore.getGoodsReceipts({
        search: searchParams.get("search") || undefined,
        status: searchParams.get("status") || undefined,
      });
      return NextResponse.json({
        success: true,
        data: list,
        meta: { total: list.length },
      });
    }
    if (
      path === "purchase/receive/approved-orders" ||
      path === "purchase/receipts/approved-orders"
    ) {
      const list = await purchaseStore.getApprovedOrdersForReceiving();
      return NextResponse.json({
        success: true,
        data: list,
        meta: { total: list.length },
      });
    }

    // 6. PURCHASE RETURNS
    if (path === "purchase/returns") {
      const list = await purchaseStore.getPurchaseReturns({
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
      const list = await purchaseStore.getEligibleReceiptsForReturn();
      return NextResponse.json({
        success: true,
        data: list,
        meta: { total: list.length },
      });
    }

    // 7. SUPPLIER PAYMENTS & INVOICES
    if (path === "purchase/supplier-payments") {
      const list = await purchaseStore.getSupplierPayments({
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
      const list = await purchaseStore.getSupplierInvoices({
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

    if (path === "purchase/supplier-payments/history") {
      const data = await listPaymentHistory();
      return NextResponse.json({ success: true, data, meta: { total: data.length } });
    }
    if (path === "purchase/supplier-payments/advances") {
      const data = await listSupplierAdvances();
      return NextResponse.json({ success: true, data, meta: { total: data.length } });
    }
    if (path === "purchase/supplier-bills") {
      const data = await listSupplierBills();
      return NextResponse.json({ success: true, data, meta: { total: data.length } });
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
      const report = await purchaseStore.generateReport(query);
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
      const report = await purchaseStore.generateReport(query);
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
  } catch (err) {
    return errorResponse(err, 500);
  }
}

async function handlePOST(
  request: Request,
  { params }: { params: Promise<{ route: string[] }> },
  actor: Actor
) {
  const { route } = await params;
  const path = route.join("/");

  try {
    const body = await request.json().catch(() => ({}));
    // Recorded as "prepared by" / "received by": the signed-in user.
    const actorName = actor.name ?? actor.id;

    // Create Requisition
    if (path === "purchase/requisitions") {
      const validated = CreateRequisitionSchema.parse(body);
      const created = await purchaseStore.createRequisition(validated, actorName);
      return NextResponse.json({ success: true, data: created }, { status: 201 });
    }

    // Requisition actions
    if (
      route[0] === "purchase" &&
      route[1] === "requisitions" &&
      route.length === 4
    ) {
      const id = route[2];
      const action = route[3];
      const comments = body?.comments || "";

      if (action === "approve") {
        const updated = await purchaseStore.updateRequisitionStatus(
          id,
          "APPROVE",
          actorName,
          comments,
          actor
        );
        return NextResponse.json({ success: true, data: updated });
      }
      if (action === "reject") {
        const updated = await purchaseStore.updateRequisitionStatus(
          id,
          "REJECT",
          actorName,
          comments,
          actor
        );
        return NextResponse.json({ success: true, data: updated });
      }
      if (action === "cancel") {
        const updated = await purchaseStore.updateRequisitionStatus(
          id,
          "CANCEL",
          actorName,
          comments,
          actor
        );
        return NextResponse.json({ success: true, data: updated });
      }
      if (action === "reverse") {
        const updated = await purchaseStore.updateRequisitionStatus(
          id,
          "REVERSE",
          actorName,
          comments || "Requisition reversed to submitted status."
        );
        return NextResponse.json({ success: true, data: updated });
      }
      if (action === "method") {
        const updated = await purchaseStore.setRequisitionMethod(id, String(body?.purchaseMethod ?? ""), actorName);
        return NextResponse.json({ success: true, data: updated });
      }
    }

    // Create Purchase Order
    if (path === "purchase/orders") {
      const validated = CreatePurchaseOrderSchema.parse(body);
      const created = await purchaseStore.createPurchaseOrder(validated, actorName);
      return NextResponse.json({ success: true, data: created }, { status: 201 });
    }

    // Purchase Order status actions
    if (route[0] === "purchase" && route[1] === "orders" && route.length === 4) {
      const id = route[2];
      const action = route[3];
      const comments = body?.comments || "";
      if (action === "approve") {
        const updated = await purchaseStore.updatePurchaseOrderStatus(
          id,
          "APPROVE",
          actorName,
          comments,
          actor
        );
        return NextResponse.json({ success: true, data: updated });
      }
      if (action === "close") {
        const updated = await purchaseStore.updatePurchaseOrderStatus(
          id,
          "CLOSE",
          actorName,
          comments,
          actor
        );
        return NextResponse.json({ success: true, data: updated });
      }
      if (action === "reverse") {
        const updated = await purchaseStore.updatePurchaseOrderStatus(
          id,
          "REVERSE",
          actorName,
          comments,
          actor
        );
        return NextResponse.json({ success: true, data: updated });
      }
      if (action === "cancel") {
        const updated = await purchaseStore.updatePurchaseOrderStatus(
          id,
          "CANCEL",
          actorName,
          comments,
          actor
        );
        return NextResponse.json({ success: true, data: updated });
      }
    }

    // Create Goods Receipt (supports both /purchase/receive and /purchase/receipts)
    if (path === "purchase/receive" || path === "purchase/receipts") {
      const validated = CreateGoodsReceiptSchema.parse({
        ...body,
        purchaseOrderId: body.purchaseOrderId || "DIRECT",
      });
      const created = await purchaseStore.createGoodsReceipt(
        {
          ...validated,
          supplierId: body.supplierId,
          officeId: body.officeId,
          warehouseId: body.warehouseId,
          challanNumber: body.challanNumber,
          gatePassNumber: body.gatePassNumber,
        },
        actorName
      );
      return NextResponse.json({ success: true, data: created }, { status: 201 });
    }

    // Create Purchase Return
    if (path === "purchase/returns") {
      const validated = CreatePurchaseReturnSchema.parse({
        ...body,
        goodsReceiptId: body.goodsReceiptId || "WITHOUT_REF",
      });
      const created = await purchaseStore.createPurchaseReturn(
        {
          ...validated,
          supplierId: body.supplierId,
          officeId: body.officeId,
          warehouseId: body.warehouseId,
        },
        actorName
      );
      return NextResponse.json({ success: true, data: created }, { status: 201 });
    }

    // Create Supplier Payment / Bill / Advance
    if (path === "purchase/supplier-payments") {
      const created = await purchaseStore.createSupplierPayment(body, actorName);
      return NextResponse.json({ success: true, data: created }, { status: 201 });
    }

    // Supplier bills: book, approve one, approve every pending bill
    if (path === "purchase/supplier-bills") {
      const created = await createSupplierBill(body, actorName);
      return NextResponse.json({ success: true, data: created }, { status: 201 });
    }
    if (path === "purchase/supplier-bills/approve-pending") {
      const result = await approvePendingSupplierBills(actorName, actor);
      return NextResponse.json({ success: true, data: result });
    }
    if (route[0] === "purchase" && route[1] === "supplier-bills" && route.length === 4 && route[3] === "approve") {
      const updated = await approveSupplierBill(route[2], actorName, actor);
      return NextResponse.json({ success: true, data: updated });
    }

    // Cancel a goods receipt, purchase return or supplier payment
    if (route[0] === "purchase" && route.length === 4 && route[3] === "cancel") {
      const id = route[2];
      const comments = body?.comments || "";
      if (route[1] === "receipts" || route[1] === "receive") {
        return NextResponse.json({ success: true, data: await purchaseStore.cancelGoodsReceipt(id, actorName, comments) });
      }
      if (route[1] === "returns") {
        return NextResponse.json({ success: true, data: await purchaseStore.cancelPurchaseReturn(id, actorName, comments) });
      }
      if (route[1] === "supplier-payments") {
        return NextResponse.json({ success: true, data: await purchaseStore.cancelSupplierPayment(id, actorName, comments) });
      }
    }

    // Approve Supplier Bill / Payment
    if (
      route[0] === "purchase" &&
      route[1] === "supplier-payments" &&
      route.length === 4 &&
      route[3] === "approve"
    ) {
      const id = route[2];
      const updated = await purchaseStore.approveSupplierPayment(id);
      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json(
      { error: { message: `POST route not found: ${path}` } },
      { status: 404 }
    );
  } catch (err) {
    return errorResponse(err, 400);
  }
}

async function handlePUT(
  request: Request,
  { params }: { params: Promise<{ route: string[] }> },
  actor: Actor
) {
  const { route } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    // Recorded as "prepared by" / "received by": the signed-in user.
    const actorName = actor.name ?? actor.id;

    // Update Requisition
    if (
      route[0] === "purchase" &&
      route[1] === "requisitions" &&
      route.length === 3
    ) {
      const id = route[2];
      const updated = await purchaseStore.updateRequisition(id, body, actorName);
      return NextResponse.json({ success: true, data: updated });
    }

    // Update Purchase Order
    if (route[0] === "purchase" && route[1] === "orders" && route.length === 3) {
      const id = route[2];
      const updated = await purchaseStore.updatePurchaseOrder(id, body, actorName);
      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json(
      { error: { message: `PUT route not found: ${route.join("/")}` } },
      { status: 404 }
    );
  } catch (err) {
    return errorResponse(err, 400);
  }
}

// Signed-in users with the purchase permission only.
export const GET = apiHandler("purchase:read", handleGET);
export const POST = apiHandler("purchase:write", handlePOST);
export const PUT = apiHandler("purchase:write", handlePUT);
