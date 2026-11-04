import {
  Office,
  Warehouse,
  Supplier,
  Item,
  PurchaseRequisition,
  PurchaseOrder,
  GoodsReceipt,
  PurchaseReturn,
  SupplierPaymentRecord,
  SupplierInvoiceItem,
  CreateRequisitionInput,
  CreatePurchaseOrderInput,
  CreateGoodsReceiptInput,
  CreatePurchaseReturnInput,
  DashboardAnalytics,
  ReportQuery,
  ReportResult,
} from "@bridgeone/contracts";
import type { Prisma, StockSource } from "@/generated/prisma/client";
import { badRequest } from "@/lib/api/errors";
import { db } from "@/lib/prisma/client";
import { assertStockAvailable, lockWarehouse } from "@/features/sales/deliveries/services/stock.service";

interface StockWarehouse {
  id: string;
  businessUnitId: string;
}

/** The warehouse a receipt or return moves stock in; it decides the business unit. */
async function stockWarehouse(warehouseId: string | null | undefined): Promise<StockWarehouse> {
  const warehouse = isUuid(warehouseId)
    ? await db().warehouse.findUnique({ where: { id: warehouseId! }, select: { id: true, office: { select: { businessUnitId: true } } } })
    : null;
  if (!warehouse) throw badRequest("Select the warehouse the goods are received into or returned from.");
  return { id: warehouse.id, businessUnitId: warehouse.office.businessUnitId };
}

/**
 * Posts purchase movements to the stock ledger (StockEntry), the same ledger
 * Sales and Production read. Lines without an item (free-text, services) are
 * not stocked. Outgoing quantities must be in stock.
 */
async function postStock(
  tx: Prisma.TransactionClient,
  warehouse: StockWarehouse,
  lines: { itemId: string | null; qty: number }[],
  entry: { source: StockSource; sourceId: string; postingDate: Date; remarks: string; createdBy: string },
) {
  const qtyByItem = new Map<string, number>();
  for (const line of lines) {
    if (line.itemId && line.qty) qtyByItem.set(line.itemId, (qtyByItem.get(line.itemId) ?? 0) + line.qty);
  }
  if (!qtyByItem.size) return;

  const items = await tx.item.findMany({
    where: { id: { in: [...qtyByItem.keys()] }, businessUnitId: warehouse.businessUnitId },
    select: { id: true, name: true },
  });
  if (items.length !== qtyByItem.size) throw badRequest("Some items do not belong to the warehouse's business unit.");

  const outgoing = new Map([...qtyByItem].filter(([, qty]) => qty < 0).map(([id, qty]) => [id, -qty]));
  if (outgoing.size) await assertStockAvailable(tx, warehouse.id, outgoing, new Map(items.map((i) => [i.id, i.name])));

  await tx.stockEntry.createMany({
    data: [...qtyByItem].map(([itemId, qty]) => ({
      businessUnitId: warehouse.businessUnitId,
      warehouseId: warehouse.id,
      itemId,
      qty,
      source: entry.source,
      sourceId: entry.sourceId,
      postingDate: entry.postingDate,
      remarks: entry.remarks,
      createdBy: entry.createdBy.slice(0, 100),
    })),
  });
}

function toDateStr(d: Date | string | null | undefined): string {
  if (!d) return new Date().toISOString().split("T")[0];
  if (typeof d === "string") return d.split("T")[0];
  return d.toISOString().split("T")[0];
}

function isUuid(val: string | undefined | null): boolean {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

class PurchaseDataStore {
  private async getContextData() {
    const prisma = db();
    const bu = await prisma.businessUnit.findFirst({
      include: { company: true },
      orderBy: { createdAt: "asc" },
    });
    return {
      businessUnitId: bu?.id || "",
      companyId: bu?.companyId || "",
      companyName: bu?.company?.name || "BridgeOne Technologies Ltd.",
    };
  }

  // -------------------------------------------------------------
  // MASTER DATA
  // -------------------------------------------------------------
  public async getOffices(): Promise<Office[]> {
    const rows = await db().office.findMany({ orderBy: { name: "asc" } });
    return rows.map((o) => ({
      id: o.id,
      code: o.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() || "OFF",
      name: o.name,
      address: o.address || "",
    }));
  }

  public async getWarehouses(officeId?: string): Promise<Warehouse[]> {
    const where = officeId && officeId !== "ALL" && isUuid(officeId) ? { officeId } : undefined;
    const rows = await db().warehouse.findMany({
      where,
      orderBy: { name: "asc" },
    });
    return rows.map((w) => ({
      id: w.id,
      code: w.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() || "WH",
      name: w.name,
      officeId: w.officeId,
    }));
  }

  public async getSuppliers(): Promise<Supplier[]> {
    const rows = await db().supplier.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    return rows.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      contactPerson: s.contactPerson || s.name,
      email: s.email || undefined,
      phone: s.phone || "N/A",
      address: s.address || "",
      taxNumber: s.taxNumber || undefined,
      type: s.type === "FOREIGN" ? ("FOREIGN" as const) : ("LOCAL" as const),
      status: s.isActive ? ("ACTIVE" as const) : ("INACTIVE" as const),
      balance: Number(s.balance ?? 0),
    }));
  }

  public async getItems(): Promise<Item[]> {
    const rows = await db().item.findMany({
      where: { isActive: true },
      include: { category: true },
      orderBy: { name: "asc" },
    });
    return rows.map((i) => ({
      id: i.id,
      code: i.code,
      name: i.name,
      category: i.category?.name || "General",
      uom: i.uom || "PCS",
      standardPrice: Number(i.purchasePrice ?? i.salesRate ?? 0),
      description: i.name,
    }));
  }

  public async getContext() {
    const { companyId, companyName } = await this.getContextData();
    return {
      company: {
        id: companyId,
        code: "BRG-TECH",
        name: companyName,
        currency: "BDT",
      },
      user: {
        id: "usr-bridgeone-procurement-mgr",
        name: "Procurement Manager",
        role: "PURCHASE_MANAGER",
      },
    };
  }

  // -------------------------------------------------------------
  // REQUISITIONS
  // -------------------------------------------------------------
  public async getRequisitions(filters: {
    officeId?: string;
    warehouseId?: string;
    status?: string;
    search?: string;
    fromDate?: string;
    toDate?: string;
    requestType?: string;
    section?: string;
  }): Promise<PurchaseRequisition[]> {
    const rows = await db().purchaseRequisition.findMany({
      include: { lines: true, office: true, warehouse: true },
      orderBy: { createdAt: "desc" },
    });

    return rows
      .map((r) => {
        let status: PurchaseRequisition["status"] = "SUBMITTED";
        if (r.status === "DRAFT") status = "DRAFT";
        else if (r.status === "PENDING") status = "SUBMITTED";
        else if (r.status === "APPROVED") status = "APPROVED";
        else if (r.status === "REJECTED") status = "REJECTED";
        else if (r.status === "ORDERED") status = "CONVERTED_TO_PO";
        else if (r.status === "CANCELLED") status = "CANCELLED";

        const items = r.lines.map((l) => ({
          id: l.id,
          itemId: l.itemId || "",
          itemCode: l.itemCode,
          itemName: l.itemName,
          uom: l.uom,
          quantity: Number(l.quantity),
          estimatedUnitPrice: Number(l.estimatedUnitPrice),
          lineTotal: Number(l.lineTotal),
          remarks: l.remarks || undefined,
        }));

        return {
          id: r.id,
          companyId: r.businessUnitId,
          officeId: r.officeId,
          warehouseId: r.warehouseId || "",
          requisitionNumber: r.number,
          requestDate: toDateStr(r.requisitionDate),
          requiredDeliveryDate: toDateStr(r.requiredDate),
          requestType: (r.requestType as any) || "LOCAL",
          purchaseMethod: (r.purchaseMethod as any) || "DIRECT",
          department: r.department,
          section: r.department,
          requesterName: r.requestedBy,
          businessJustification: r.notes || "Operational replenishment",
          remarks: r.notes || undefined,
          totalEstimatedAmount: Number(r.totalEstimated),
          status,
          createdBy: r.requestedBy,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
          approvalHistory: [],
          items,
        };
      })
      .filter((r) => {
        if (filters.officeId && filters.officeId !== "ALL" && r.officeId !== filters.officeId) return false;
        if (filters.warehouseId && filters.warehouseId !== "ALL" && r.warehouseId !== filters.warehouseId) return false;
        if (filters.status && filters.status !== "ALL" && r.status !== filters.status) return false;
        if (filters.requestType && filters.requestType !== "ALL" && r.requestType !== filters.requestType) return false;
        if (filters.section && filters.section !== "ALL" && r.department !== filters.section) return false;
        if (filters.fromDate && r.requestDate < filters.fromDate) return false;
        if (filters.toDate && r.requestDate > filters.toDate) return false;
        if (filters.search) {
          const s = filters.search.toLowerCase();
          return r.requisitionNumber.toLowerCase().includes(s) || r.requesterName.toLowerCase().includes(s);
        }
        return true;
      });
  }

  public async getRequisitionById(id: string): Promise<PurchaseRequisition | null> {
    const list = await this.getRequisitions({});
    return list.find((r) => r.id === id || r.requisitionNumber === id) || null;
  }

  public async createRequisition(input: CreateRequisitionInput, actorName: string = "Admin"): Promise<PurchaseRequisition> {
    const prisma = db();
    const { businessUnitId } = await this.getContextData();

    // Ensure valid office
    let officeId = input.officeId;
    if (!isUuid(officeId)) {
      const firstOffice = await prisma.office.findFirst();
      officeId = firstOffice?.id || "";
    }

    let warehouseId: string | null = input.warehouseId;
    if (!isUuid(warehouseId)) {
      const firstWh = await prisma.warehouse.findFirst({ where: { officeId } });
      warehouseId = firstWh?.id || null;
    }

    const count = await prisma.purchaseRequisition.count({ where: { businessUnitId } });
    const number = `REQ-2026-${String(count + 101).padStart(5, "0")}`;

    let totalEst = 0;
    const linesData = input.items.map((it, idx) => {
      const qty = Number(it.quantity) || 1;
      const rate = Number(it.estimatedUnitPrice) || 0;
      const total = qty * rate;
      totalEst += total;
      return {
        lineNo: idx + 1,
        itemId: isUuid(it.itemId) ? it.itemId : null,
        itemCode: it.itemCode || `ITM-${idx + 1}`,
        itemName: it.itemName || "Item",
        uom: it.uom || "PCS",
        quantity: qty,
        estimatedUnitPrice: rate,
        lineTotal: total,
        remarks: it.remarks || null,
      };
    });

    const created = await prisma.purchaseRequisition.create({
      data: {
        businessUnitId,
        officeId,
        warehouseId,
        number,
        department: input.department || "Operations",
        requestedBy: input.requesterName || actorName,
        requisitionDate: new Date(input.requestDate || new Date()),
        requiredDate: new Date(input.requiredDeliveryDate || new Date()),
        status: "PENDING",
        requestType: input.requestType || "LOCAL",
        purchaseMethod: input.purchaseMethod || "DIRECT",
        totalEstimated: totalEst,
        notes: input.remarks || input.businessJustification || null,
        lines: { create: linesData },
      },
      include: { lines: true, office: true, warehouse: true },
    });

    const result = await this.getRequisitionById(created.id);
    return result!;
  }

  public async updateRequisitionStatus(id: string, action: string, actorName: string, comments?: string) {
    const prisma = db();
    let status: any = "PENDING";
    if (action === "APPROVE") status = "APPROVED";
    else if (action === "REJECT") status = "REJECTED";
    else if (action === "CANCEL") status = "CANCELLED";
    else if (action === "REVERSE") status = "PENDING";

    const updated = await prisma.purchaseRequisition.update({
      where: isUuid(id) ? { id } : { id: (await prisma.purchaseRequisition.findFirst({ where: { number: id } }))?.id },
      data: { status, notes: comments || undefined },
    });
    return this.getRequisitionById(updated.id);
  }

  public async updateRequisition(id: string, input: Partial<CreateRequisitionInput>, actorName: string) {
    const prisma = db();
    const req = await prisma.purchaseRequisition.findFirst({
      where: isUuid(id) ? { id } : { number: id },
    });
    if (!req) throw new Error("Requisition not found");

    if (input.items && input.items.length > 0) {
      await prisma.purchaseRequisitionLine.deleteMany({ where: { requisitionId: req.id } });
      let totalEst = 0;
      const linesData = input.items.map((it, idx) => {
        const qty = Number(it.quantity) || 1;
        const rate = Number(it.estimatedUnitPrice) || 0;
        const total = qty * rate;
        totalEst += total;
        return {
          lineNo: idx + 1,
          itemId: isUuid(it.itemId) ? it.itemId : null,
          itemCode: it.itemCode || `ITM-${idx + 1}`,
          itemName: it.itemName || "Item",
          uom: it.uom || "PCS",
          quantity: qty,
          estimatedUnitPrice: rate,
          lineTotal: total,
        };
      });
      await prisma.purchaseRequisitionLine.createMany({
        data: linesData.map((l) => ({ ...l, requisitionId: req.id })),
      });
      await prisma.purchaseRequisition.update({
        where: { id: req.id },
        data: { totalEstimated: totalEst },
      });
    }

    return this.getRequisitionById(req.id);
  }

  // -------------------------------------------------------------
  // PURCHASE ORDERS
  // -------------------------------------------------------------
  public async getPurchaseOrders(filters: {
    officeId?: string;
    supplierId?: string;
    status?: string;
    search?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<PurchaseOrder[]> {
    const rows = await db().purchaseOrder.findMany({
      include: { lines: true, supplier: true, office: true, warehouse: true, requisition: true },
      orderBy: { createdAt: "desc" },
    });

    return rows
      .map((po) => {
        let status: PurchaseOrder["status"] = "APPROVED";
        if (po.status === "DRAFT") status = "DRAFT";
        else if (po.status === "PENDING") status = "PENDING_APPROVAL";
        else if (po.status === "APPROVED") status = "APPROVED";
        else if (po.status === "PARTIAL_RECEIVED") status = "PARTIALLY_RECEIVED";
        else if (po.status === "RECEIVED") status = "COMPLETED";
        else if (po.status === "CLOSED") status = "CANCELLED";
        else if (po.status === "CANCELLED") status = "CANCELLED";

        const items = po.lines.map((l) => ({
          id: l.id,
          itemId: l.itemId || "",
          itemCode: l.itemCode,
          itemName: l.itemName,
          uom: l.uom,
          orderedQuantity: Number(l.quantity),
          receivedQuantity: Number(l.receivedQuantity),
          returnedQuantity: 0,
          outstandingQuantity: Math.max(0, Number(l.quantity) - Number(l.receivedQuantity)),
          unitPrice: Number(l.unitPrice),
          discountPercentage: Number(l.discountPercent),
          discountAmount: 0,
          taxPercentage: Number(l.vatPercent),
          taxAmount: 0,
          lineTotal: Number(l.lineTotal),
          remarks: l.remarks || undefined,
        }));

        return {
          id: po.id,
          companyId: po.businessUnitId,
          requisitionId: po.requisitionId || undefined,
          requisitionNumber: po.requisition?.number || undefined,
          supplierId: po.supplierId,
          supplierName: po.supplier?.name || "Supplier",
          officeId: po.officeId,
          officeName: po.office?.name || "Office",
          warehouseId: po.warehouseId || "",
          warehouseName: po.warehouse?.name || "Warehouse",
          poNumber: po.number,
          orderDate: toDateStr(po.orderDate),
          expectedDeliveryDate: toDateStr(po.expectedDeliveryDate || po.orderDate),
          referenceNumber: po.referenceNumber || undefined,
          paymentTerms: "Net 30 Days",
          deliveryTerms: "FOB Warehouse",
          shippingFee: Number(po.shippingFee),
          subtotal: Number(po.subtotal),
          totalDiscount: Number(po.totalDiscount),
          totalTax: Number(po.totalTax),
          totalAmount: Number(po.totalAmount),
          status,
          createdBy: po.createdBy,
          createdAt: po.createdAt.toISOString(),
          updatedAt: po.updatedAt.toISOString(),
          approvalHistory: [],
          items,
        };
      })
      .filter((po) => {
        if (filters.officeId && filters.officeId !== "ALL" && po.officeId !== filters.officeId) return false;
        if (filters.supplierId && filters.supplierId !== "ALL" && po.supplierId !== filters.supplierId) return false;
        if (filters.status && filters.status !== "ALL" && po.status !== filters.status) return false;
        if (filters.fromDate && po.orderDate < filters.fromDate) return false;
        if (filters.toDate && po.orderDate > filters.toDate) return false;
        if (filters.search) {
          const s = filters.search.toLowerCase();
          return po.poNumber.toLowerCase().includes(s) || po.supplierName.toLowerCase().includes(s);
        }
        return true;
      });
  }

  public async getPurchaseOrderById(id: string): Promise<PurchaseOrder | null> {
    const list = await this.getPurchaseOrders({});
    return list.find((p) => p.id === id || p.poNumber === id) || null;
  }

  public async createPurchaseOrder(input: CreatePurchaseOrderInput, actorName: string = "Admin"): Promise<PurchaseOrder> {
    const prisma = db();
    const { businessUnitId } = await this.getContextData();

    let officeId = input.officeId;
    if (!isUuid(officeId)) {
      const firstOff = await prisma.office.findFirst();
      officeId = firstOff?.id || "";
    }

    let warehouseId: string | null = input.warehouseId;
    if (!isUuid(warehouseId)) {
      const firstWh = await prisma.warehouse.findFirst({ where: { officeId } });
      warehouseId = firstWh?.id || null;
    }

    let supplierId = input.supplierId;
    if (!isUuid(supplierId)) {
      const firstSup = await prisma.supplier.findFirst();
      supplierId = firstSup?.id || "";
    }

    const count = await prisma.purchaseOrder.count({ where: { businessUnitId } });
    const number = `PO-2026-${String(count + 88).padStart(5, "0")}`;

    let subtotal = 0;
    const linesData = input.items.map((it, idx) => {
      const qty = Number(it.orderedQuantity) || 1;
      const rate = Number(it.unitPrice) || 0;
      const lineTotal = qty * rate;
      subtotal += lineTotal;
      return {
        lineNo: idx + 1,
        itemId: isUuid(it.itemId) ? it.itemId : null,
        itemCode: it.itemCode || `ITM-${idx + 1}`,
        itemName: it.itemName || "Item",
        uom: it.uom || "PCS",
        quantity: qty,
        unitPrice: rate,
        discountPercent: it.discountPercentage || 0,
        vatPercent: it.taxPercentage || 0,
        lineTotal,
        receivedQuantity: 0,
      };
    });

    const shipping = Number(input.shippingFee) || 0;
    const totalAmount = subtotal + shipping;

    const created = await prisma.purchaseOrder.create({
      data: {
        businessUnitId,
        officeId,
        warehouseId,
        supplierId,
        requisitionId: isUuid(input.requisitionId) ? input.requisitionId : null,
        number,
        orderDate: new Date(input.orderDate || new Date()),
        expectedDeliveryDate: new Date(input.expectedDeliveryDate || new Date()),
        referenceNumber: input.referenceNumber || null,
        status: "APPROVED",
        subtotal,
        totalDiscount: 0,
        totalTax: 0,
        shippingFee: shipping,
        totalAmount,
        createdBy: actorName,
        lines: { create: linesData },
      },
      include: { lines: true, supplier: true, office: true, warehouse: true, requisition: true },
    });

    if (input.requisitionId) {
      await prisma.purchaseRequisition.updateMany({
        where: isUuid(input.requisitionId) ? { id: input.requisitionId } : { number: input.requisitionId },
        data: { status: "ORDERED" },
      });
    }

    const res = await this.getPurchaseOrderById(created.id);
    return res!;
  }

  public async updatePurchaseOrder(id: string, input: Partial<CreatePurchaseOrderInput>, actorName: string) {
    const prisma = db();
    const po = await prisma.purchaseOrder.findFirst({
      where: isUuid(id) ? { id } : { number: id },
    });
    if (!po) throw new Error("Purchase Order not found");

    if (input.items && input.items.length > 0) {
      await prisma.purchaseOrderLine.deleteMany({ where: { orderId: po.id } });
      let subtotal = 0;
      const linesData = input.items.map((it, idx) => {
        const qty = Number(it.orderedQuantity) || 1;
        const rate = Number(it.unitPrice) || 0;
        const lineTotal = qty * rate;
        subtotal += lineTotal;
        return {
          lineNo: idx + 1,
          itemId: isUuid(it.itemId) ? it.itemId : null,
          itemCode: it.itemCode || `ITM-${idx + 1}`,
          itemName: it.itemName || "Item",
          uom: it.uom || "PCS",
          quantity: qty,
          unitPrice: rate,
          lineTotal,
          receivedQuantity: 0,
        };
      });
      await prisma.purchaseOrderLine.createMany({
        data: linesData.map((l) => ({ ...l, orderId: po.id })),
      });
      await prisma.purchaseOrder.update({
        where: { id: po.id },
        data: { subtotal, totalAmount: subtotal + Number(po.shippingFee) },
      });
    }

    return this.getPurchaseOrderById(po.id);
  }

  public async updatePurchaseOrderStatus(id: string, action: string, actorName: string, comments?: string) {
    const prisma = db();
    let status: any = "APPROVED";
    if (action === "CLOSE") status = "CLOSED";
    else if (action === "REVERSE") status = "PENDING";
    else if (action === "CANCEL") status = "CANCELLED";

    const updated = await prisma.purchaseOrder.update({
      where: isUuid(id) ? { id } : { id: (await prisma.purchaseOrder.findFirst({ where: { number: id } }))?.id },
      data: { status, notes: comments || undefined },
    });
    return this.getPurchaseOrderById(updated.id);
  }

  // -------------------------------------------------------------
  // GOODS RECEIPT (GRN)
  // -------------------------------------------------------------
  public async getGoodsReceipts(filters: { search?: string; status?: string }): Promise<GoodsReceipt[]> {
    const rows = await db().goodsReceipt.findMany({
      include: { lines: true, supplier: true, office: true, warehouse: true, order: { include: { requisition: true } } },
      orderBy: { createdAt: "desc" },
    });

    return rows
      .map((g) => {
        let status: GoodsReceipt["status"] = "RECEIVED";
        if (g.status === "DRAFT") status = "DRAFT";
        else if (g.status === "CANCELLED") status = "CANCELLED";

        const items = g.lines.map((l) => ({
          id: l.id,
          poItemId: l.id,
          itemId: l.itemId || "",
          itemCode: l.itemCode,
          itemName: l.itemName,
          uom: l.uom,
          orderedQuantity: Number(l.orderedQty),
          previouslyReceivedQuantity: 0,
          currentReceivedQuantity: Number(l.receivedQty),
          rejectedDamagedQuantity: Number(l.rejectedQty),
          unitPrice: Number(l.unitPrice),
          lineTotal: Number(l.lineTotal),
          remarks: l.remarks || undefined,
        }));

        return {
          id: g.id,
          companyId: g.businessUnitId,
          purchaseOrderId: g.orderId,
          grnNumber: g.number,
          receiptDate: toDateStr(g.receiveDate),
          poNumber: g.order?.number || "DIRECT-PO",
          poDate: toDateStr(g.order?.orderDate || g.receiveDate),
          requisitionNumber: g.order?.requisition?.number || undefined,
          supplierId: g.supplierId,
          supplierName: g.supplier?.name || "Supplier",
          officeId: g.officeId,
          officeName: g.office?.name || "Office",
          warehouseId: g.warehouseId || "",
          warehouseName: g.warehouse?.name || "Warehouse",
          challanNumber: g.challanNumber || "CH-001",
          supplierInvoiceNumber: g.challanNumber || undefined,
          gatePassNumber: g.gatePassNumber || undefined,
          totalReceivedAmount: Number(g.totalAmount),
          status,
          preparedBy: g.receivedBy,
          stockMovementSyncStatus: "LIVE" as const,
          createdAt: g.createdAt.toISOString(),
          items,
        };
      })
      .filter((g) => {
        if (filters.status && filters.status !== "ALL" && g.status !== filters.status) return false;
        if (filters.search) {
          const s = filters.search.toLowerCase();
          return g.grnNumber.toLowerCase().includes(s) || g.poNumber.toLowerCase().includes(s) || g.supplierName.toLowerCase().includes(s);
        }
        return true;
      });
  }

  public async getApprovedOrdersForReceiving(): Promise<PurchaseOrder[]> {
    const list = await this.getPurchaseOrders({});
    return list.filter((p) => p.status === "APPROVED" || p.status === "PARTIALLY_RECEIVED");
  }

  public async createGoodsReceipt(input: any, actorName: string = "Store Officer"): Promise<GoodsReceipt> {
    const prisma = db();
    const { businessUnitId } = await this.getContextData();

    let po = await prisma.purchaseOrder.findFirst({
      where: isUuid(input.purchaseOrderId) ? { id: input.purchaseOrderId } : { number: input.purchaseOrderId },
      include: { lines: true },
    });

    if (!po) {
      // Auto-create a PO if direct receiving
      const createdPo = await this.createPurchaseOrder(
        {
          officeId: input.officeId || "",
          warehouseId: input.warehouseId || "",
          supplierId: input.supplierId || "",
          orderDate: input.receiptDate || toDateStr(new Date()),
          expectedDeliveryDate: input.receiptDate || toDateStr(new Date()),
          companyId: 'comp-bridgeone-01',
 paymentTerms: 'Net 30 Days',
 deliveryTerms: 'FOB Destination',
 shippingFee: 0,
 items: input.items.map((it: any) => ({
            itemId: it.itemId,
            itemCode: it.itemCode,
            itemName: it.itemName,
            uom: it.uom,
            orderedQuantity: Number(it.currentReceivedQuantity),
            unitPrice: Number(it.unitPrice || 0),
          })),
        },
        actorName
      );
      po = await prisma.purchaseOrder.findUnique({
        where: { id: createdPo.id },
        include: { lines: true },
      });
    }

    if (!po) throw new Error("Purchase Order not found for Receipt");

    const count = await prisma.goodsReceipt.count({ where: { businessUnitId } });
    const number = `GRN-2026-${String(count + 46).padStart(5, "0")}`;

    let totalAmount = 0;
    const receivedItems = input.items.filter((it: any) => Number(it.currentReceivedQuantity) > 0);
    if (!receivedItems.length) throw badRequest("Enter a received quantity for at least one item.");
    const linesData = receivedItems.map((it: any, idx: number) => {
      const recvQty = Number(it.currentReceivedQuantity);
      const rejQty = Number(it.rejectedDamagedQuantity) || 0;
      const rate = Number(it.unitPrice) || 0;
      const total = recvQty * rate;
      totalAmount += total;
      return {
        lineNo: idx + 1,
        itemId: isUuid(it.itemId) ? it.itemId : null,
        itemCode: it.itemCode || `ITM-${idx + 1}`,
        itemName: it.itemName || "Item",
        uom: it.uom || "PCS",
        orderedQty: recvQty,
        receivedQty: recvQty,
        acceptedQty: Math.max(0, recvQty - rejQty),
        rejectedQty: rejQty,
        unitPrice: rate,
        lineTotal: total,
      };
    });

    const warehouse = await stockWarehouse(po.warehouseId || input.warehouseId);
    const receivedAt = new Date(input.receiptDate || new Date());

    const created = await prisma.$transaction(async (tx) => {
    await lockWarehouse(tx, warehouse.id);
    const receipt = await tx.goodsReceipt.create({
      data: {
        businessUnitId: warehouse.businessUnitId,
        officeId: po.officeId,
        warehouseId: warehouse.id,
        orderId: po.id,
        supplierId: po.supplierId,
        number,
        receiveDate: receivedAt,
        challanNumber: input.challanNumber || null,
        gatePassNumber: input.gatePassNumber || null,
        status: "RECEIVED",
        totalAmount,
        receivedBy: actorName,
        lines: { create: linesData },
      },
    });

    // Accepted quantities go into the warehouse, so Sales and Production see the stock.
    await postStock(tx, warehouse, linesData.map((l: { itemId: string | null; acceptedQty: number }) => ({ itemId: l.itemId, qty: l.acceptedQty })), {
      source: "PURCHASE_RECEIPT",
      sourceId: receipt.id,
      postingDate: receivedAt,
      remarks: `Goods receipt ${number}`,
      createdBy: actorName,
    });

    // Update PO status
    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { status: "RECEIVED" },
    });

    // Update supplier balance
    if (totalAmount > 0) {
      await tx.supplier.update({
        where: { id: po.supplierId },
        data: { balance: { increment: totalAmount } },
      });
    }
    return receipt;
    });

    const res = await this.getGoodsReceipts({});
    return res.find((g) => g.id === created.id)!;
  }

  // -------------------------------------------------------------
  // PURCHASE RETURNS
  // -------------------------------------------------------------
  public async getPurchaseReturns(filters: { search?: string; status?: string }): Promise<PurchaseReturn[]> {
    const rows = await db().purchaseReturn.findMany({
      include: { lines: true, supplier: true, office: true, warehouse: true, receipt: true, order: true },
      orderBy: { createdAt: "desc" },
    });

    return rows
      .map((pr) => {
        const items = pr.lines.map((l) => ({
          id: l.id,
          grnItemId: l.id,
          itemId: l.itemId || "",
          itemCode: l.itemCode,
          itemName: l.itemName,
          uom: l.uom,
          receivedQuantity: Number(l.qty),
          previouslyReturnedQuantity: 0,
          eligibleReturnQuantity: Number(l.qty),
          returnQuantity: Number(l.qty),
          unitPrice: Number(l.unitPrice),
          lineTotal: Number(l.amount),
          reason: l.reason || pr.reason || "Defective",
          condition: "DAMAGED" as const,
        }));

        return {
          id: pr.id,
          companyId: pr.businessUnitId,
          goodsReceiptId: pr.receiptId || "WITHOUT_REF",
          returnNumber: pr.number,
          returnDate: toDateStr(pr.returnDate),
          grnNumber: pr.receipt?.number || "Direct Return",
          poNumber: pr.order?.number || "N/A",
          supplierId: pr.supplierId,
          supplierName: pr.supplier?.name || "Supplier",
          officeId: pr.officeId,
          officeName: pr.office?.name || "Office",
          totalReturnAmount: Number(pr.totalAmount),
 returnType: 'REFUND_CREDIT' as const,
          status: pr.status === "CANCELLED" ? ("CANCELLED" as const) : ("COMPLETED" as const),
          createdBy: "Store Officer",
          createdAt: pr.createdAt.toISOString(),
          inventoryReversalStatus: "SYNCED" as const,
          financeCreditNoteStatus: "SYNCED" as const,
          items,
        };
      })
      .filter((pr) => {
        if (filters.status && filters.status !== "ALL" && pr.status !== filters.status) return false;
        if (filters.search) {
          const s = filters.search.toLowerCase();
          return pr.returnNumber.toLowerCase().includes(s) || pr.supplierName.toLowerCase().includes(s);
        }
        return true;
      });
  }

  public async getEligibleReceiptsForReturn(): Promise<GoodsReceipt[]> {
    return this.getGoodsReceipts({});
  }

  public async createPurchaseReturn(input: any, actorName: string = "Store Officer"): Promise<PurchaseReturn> {
    const prisma = db();
    const { businessUnitId } = await this.getContextData();

    const grn = await prisma.goodsReceipt.findFirst({
      where: isUuid(input.goodsReceiptId) ? { id: input.goodsReceiptId } : { number: input.goodsReceiptId },
      include: { supplier: true, order: true },
    });

    const warehouse = await stockWarehouse(grn?.warehouseId || input.warehouseId);
    const officeId = grn?.officeId || (await prisma.warehouse.findUniqueOrThrow({ where: { id: warehouse.id }, select: { officeId: true } })).officeId;
    const supplierId = grn?.supplierId || (isUuid(input.supplierId) ? input.supplierId : "");
    if (!supplierId) throw badRequest("Select the supplier the goods are returned to.");

    const count = await prisma.purchaseReturn.count({ where: { businessUnitId } });
    const number = `PR-2026-${String(count + 13).padStart(5, "0")}`;

    let totalAmount = 0;
    const linesData = input.items.map((it: any, idx: number) => {
      const qty = Number(it.returnQuantity) || 1;
      const rate = Number(it.unitPrice) || 0;
      const lineTotal = qty * rate;
      totalAmount += lineTotal;
      return {
        lineNo: idx + 1,
        itemId: isUuid(it.itemId) ? it.itemId : null,
        itemCode: it.itemCode || `ITM-${idx + 1}`,
        itemName: it.itemName || "Item",
        uom: it.uom || "PCS",
        qty,
        unitPrice: rate,
        amount: lineTotal,
        reason: it.reason || "Defective",
      };
    });

    const returnedAt = new Date(input.returnDate || new Date());

    const created = await prisma.$transaction(async (tx) => {
    await lockWarehouse(tx, warehouse.id);
    const purchaseReturn = await tx.purchaseReturn.create({
      data: {
        businessUnitId: warehouse.businessUnitId,
        officeId,
        warehouseId: warehouse.id,
        supplierId,
        receiptId: grn?.id || null,
        orderId: grn?.orderId || null,
        number,
        returnDate: returnedAt,
        reason: input.items[0]?.reason || "Defective",
        status: "COMPLETED",
        totalAmount,
        lines: { create: linesData },
      },
    });

    // Returned goods leave the warehouse; refuses to return more than is in stock.
    await postStock(tx, warehouse, linesData.map((l: { itemId: string | null; qty: number }) => ({ itemId: l.itemId, qty: -l.qty })), {
      source: "PURCHASE_RETURN",
      sourceId: purchaseReturn.id,
      postingDate: returnedAt,
      remarks: `Purchase return ${number}`,
      createdBy: actorName,
    });

    if (totalAmount > 0) {
      await tx.supplier.update({
        where: { id: supplierId },
        data: { balance: { decrement: totalAmount } },
      });
    }
    return purchaseReturn;
    });

    const res = await this.getPurchaseReturns({});
    return res.find((r) => r.id === created.id)!;
  }

  // -------------------------------------------------------------
  // SUPPLIER PAYMENTS & PAYABLES
  // -------------------------------------------------------------
  public async getSupplierPayments(filters: { search?: string; status?: string; category?: string }): Promise<SupplierPaymentRecord[]> {
    const prisma = db();
    // Payable = goods received - goods returned - payments (the same movements that change supplier.balance).
    const [suppliers, receipts, returns, payments] = await Promise.all([
      prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      prisma.goodsReceipt.findMany({ where: { status: { not: "CANCELLED" } }, select: { supplierId: true, totalAmount: true } }),
      prisma.purchaseReturn.findMany({ where: { status: { not: "CANCELLED" } }, select: { supplierId: true, totalAmount: true } }),
      prisma.supplierPayment.findMany({ where: { status: "PAID" }, select: { supplierId: true, amount: true, paymentDate: true } }),
    ]);
    const sum = (rows: { supplierId: string; totalAmount: unknown }[], supplierId: string) =>
      rows.filter((r) => r.supplierId === supplierId).reduce((total, r) => total + Number(r.totalAmount), 0);

    return suppliers
      .map((s) => {
        const totalPurchasedAmount = sum(receipts, s.id);
        const returnedAmount = sum(returns, s.id);
        const supPayments = payments.filter((p) => p.supplierId === s.id);
        const paidAmount = supPayments.reduce((total, p) => total + Number(p.amount), 0);
        const dueAmount = Math.max(0, totalPurchasedAmount - returnedAmount - paidAmount);
        const lastPayment = supPayments.reduce<Date | null>((last, p) => (!last || p.paymentDate > last ? p.paymentDate : last), null);

        let paymentStatus: SupplierPaymentRecord["paymentStatus"] = "PAID";
        if (dueAmount > 0 && paidAmount > 0) paymentStatus = "PARTIALLY_PAID";
        else if (dueAmount > 0) paymentStatus = "UNPAID";

        return {
          id: s.id,
          supplierId: s.id,
          supplierCode: s.code,
          supplierName: s.name,
          category: s.type === "FOREIGN" ? ("FOREIGN" as const) : ("LOCAL" as const),
          mobileNumber: s.phone || "N/A",
          totalPurchasedAmount,
          returnedAmount,
          paidAmount,
          dueAmount,
          lastPaymentDate: lastPayment ? toDateStr(lastPayment) : undefined,
          openInvoicesCount: receipts.filter((r) => r.supplierId === s.id).length,
          paymentStatus,
 currency: 'BDT',
        };
      })
      .filter((sp) => {
        if (filters.status && filters.status !== "ALL" && sp.paymentStatus !== filters.status) return false;
        if (filters.category && filters.category !== "ALL" && sp.category !== filters.category) return false;
        if (filters.search) {
          const s = filters.search.toLowerCase();
          return sp.supplierName.toLowerCase().includes(s) || sp.supplierCode.toLowerCase().includes(s);
        }
        return true;
      });
  }

  public async getSupplierInvoices(filters: { search?: string; status?: string; type?: string }): Promise<SupplierInvoiceItem[]> {
    const grns = await this.getGoodsReceipts({});
    return grns
      .map((g) => ({
        id: g.id,
        invoiceNumber: (g as any).challanNumber || `INV-${g.grnNumber}`,
        poNumber: g.poNumber,
        grnNumber: g.grnNumber,
        supplierName: g.supplierName,
        invoiceDate: g.receiptDate,
        dueDate: g.receiptDate,
        totalAmount: g.totalReceivedAmount,
        paidAmount: 0,
        dueAmount: g.totalReceivedAmount,
        status: "UNPAID" as const,
        type: "LOCAL" as const,
      }))
      .filter((inv) => {
        if (filters.status && filters.status !== "ALL" && inv.status !== filters.status) return false;
        if (filters.search) {
          const s = filters.search.toLowerCase();
          return inv.invoiceNumber.toLowerCase().includes(s) || inv.supplierName.toLowerCase().includes(s);
        }
        return true;
      });
  }

  public async createSupplierPayment(input: any, actorName: string = "Admin") {
    const prisma = db();
    const { businessUnitId } = await this.getContextData();

    const supplierId = input.supplierId;
    if (!isUuid(supplierId)) throw badRequest("Select the supplier being paid.");
    if (!(Number(input.amount) > 0)) throw badRequest("Enter a payment amount greater than 0.");

    const count = await prisma.supplierPayment.count({ where: { businessUnitId } });
    const number = `PAY-2026-${String(count + 101).padStart(5, "0")}`;
    const amount = Number(input.amount) || 0;

    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { businessUnitId: true } });
    if (!supplier) throw badRequest("Supplier not found.");

    const created = await prisma.$transaction(async (tx) => {
    const payment = await tx.supplierPayment.create({
      data: {
        businessUnitId: supplier.businessUnitId,
        supplierId,
        number,
        paymentDate: new Date(input.paymentDate || new Date()),
        amount,
        method: input.method || "BANK",
        status: "PAID",
        remarks: input.narration || null,
      },
    });

    await tx.supplier.update({
      where: { id: supplierId },
      data: { balance: { decrement: amount } },
    });
    return payment;
    });

    return created;
  }

  public async approveSupplierPayment(id: string) {
    return db().supplierPayment.update({
      where: isUuid(id) ? { id } : { id: (await db().supplierPayment.findFirst({ where: { number: id } }))?.id },
      data: { status: "PAID" },
    });
  }

  // -------------------------------------------------------------
  // DASHBOARD & ANALYTICS METRICS
  // -------------------------------------------------------------
  public async getDashboardAnalytics(filters?: { fromDate?: string; toDate?: string; officeId?: string }): Promise<DashboardAnalytics> {
    const [pos, reqs, payments, itemsCatalog] = await Promise.all([
      this.getPurchaseOrders(filters || {}),
      this.getRequisitions(filters || {}),
      this.getSupplierPayments({}),
      this.getItems(),
    ]);

    const itemMap = new Map(itemsCatalog.map((i) => [i.id, i]));

    const totalRequisitions = reqs.length;
    const pendingApprovals = reqs.filter((r) => r.status === "PENDING_APPROVAL" || r.status === "SUBMITTED").length;
    const approvedRequisitions = reqs.filter((r) => r.status === "APPROVED").length;

    const openPurchaseOrders = pos.filter((p) => p.status === "APPROVED").length;
    const partiallyReceivedOrders = pos.filter((p) => p.status === "PARTIALLY_RECEIVED").length;
    const completedOrders = pos.filter((p) => p.status === "COMPLETED").length;

    const totalSpendAmount = pos.reduce((sum, p) => sum + p.totalAmount, 0);
    const totalOutstandingAmount = payments.reduce((sum, s) => sum + s.dueAmount, 0);

    // 1. Type-wise purchase
    const typeMap: Record<string, { count: number; amount: number }> = {};
    for (const po of pos) {
      for (const it of po.items) {
        const cat = itemMap.get(it.itemId)?.category || "Consumables & Spares";
        if (!typeMap[cat]) typeMap[cat] = { count: 0, amount: 0 };
        typeMap[cat].count += it.orderedQuantity;
        typeMap[cat].amount += it.lineTotal;
      }
    }
    const typeWisePurchase = Object.entries(typeMap).map(([name, v]) => ({
      name,
      value: v.count,
      amount: v.amount,
    }));

    // 2. Warehouse-wise purchase
    const whMap: Record<string, { amount: number; count: number }> = {};
    for (const po of pos) {
      const wh = po.warehouseName || "Warehouse";
      if (!whMap[wh]) whMap[wh] = { amount: 0, count: 0 };
      whMap[wh].amount += po.totalAmount;
      whMap[wh].count += 1;
    }
    const warehouseWisePurchase = Object.entries(whMap).map(([warehouse, v]) => ({
      warehouse,
      amount: v.amount,
      count: v.count,
    }));

    // 3. Monthly expenditure
    const monthMap: Record<string, number> = {};
    for (const po of pos) {
      const m = po.orderDate.slice(0, 7);
      monthMap[m] = (monthMap[m] || 0) + po.totalAmount;
    }
    const monthlyExpenditure = Object.entries(monthMap).map(([month, expenditure]) => ({
      month,
      expenditure,
      budget: Math.round(expenditure * 1.1),
    }));

    // 4. PO Status distribution
    const statusMap: Record<string, number> = {};
    for (const po of pos) {
      statusMap[po.status] = (statusMap[po.status] || 0) + 1;
    }
    const poStatusDistribution = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

    // 5. Top Suppliers
    const supMap: Record<string, { totalSpend: number; poCount: number }> = {};
    for (const po of pos) {
      if (!supMap[po.supplierName]) supMap[po.supplierName] = { totalSpend: 0, poCount: 0 };
      supMap[po.supplierName].totalSpend += po.totalAmount;
      supMap[po.supplierName].poCount += 1;
    }
    const topSuppliers = Object.entries(supMap)
      .map(([supplier, v]) => ({ supplier, totalSpend: v.totalSpend, poCount: v.poCount }))
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 10);

    // 6. Top items
    const itmMap: Record<string, { quantity: number; amount: number }> = {};
    for (const po of pos) {
      for (const it of po.items) {
        if (!itmMap[it.itemName]) itmMap[it.itemName] = { quantity: 0, amount: 0 };
        itmMap[it.itemName].quantity += it.orderedQuantity;
        itmMap[it.itemName].amount += it.lineTotal;
      }
    }
    const topPurchasedItems = Object.entries(itmMap)
      .map(([item, v]) => ({ item, quantity: v.quantity, amount: v.amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    const pendingApprovalItems = reqs
      .filter((r) => r.status === "PENDING_APPROVAL" || r.status === "SUBMITTED")
      .map((r) => ({
        id: r.id,
        type: "REQUISITION" as const,
        docNumber: r.requisitionNumber,
        date: r.requestDate,
        requester: r.requesterName,
        amount: r.totalEstimatedAmount,
        status: r.status,
      }));

    return {
      kpis: {
        totalRequisitions,
        pendingApprovals,
        approvedRequisitions,
        openPurchaseOrders,
        partiallyReceivedOrders,
        completedOrders,
        pendingSupplierInvoices: 0,
        totalSpendAmount,
        totalOutstandingAmount,
      },
      typeWisePurchase,
      warehouseWisePurchase,
      monthlyExpenditure,
      poStatusDistribution,
      topSuppliers,
      topPurchasedItems,
      procurementCycleTimeDays: 5,
      pendingApprovalItems,
      isSampleData: false,
    };
  }

  // -------------------------------------------------------------
  // REPORTS
  // -------------------------------------------------------------
  public async generateReport(query: ReportQuery): Promise<ReportResult> {
    const pos = await this.getPurchaseOrders({});
    return {
      reportType: query.reportType,
      generatedAt: new Date().toISOString(),
      filtersApplied: query as any,
      columns: ["SL", "PO Number", "Date", "Supplier", "Office", "Total Amount", "Status"],
      rows: pos.map((p, idx) => ({
        SL: idx + 1,
        "PO Number": p.poNumber,
        Date: p.orderDate,
        Supplier: p.supplierName,
        Office: p.officeName,
        "Total Amount": p.totalAmount,
        Status: p.status,
      })),
      summary: { "Total Orders": pos.length },
      totalRecords: pos.length,
    };
  }
}

export const purchaseStore = new PurchaseDataStore();
