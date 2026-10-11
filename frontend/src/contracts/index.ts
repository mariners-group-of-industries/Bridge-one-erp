import { z } from "zod";

// ==========================================
// 1. COMMON ENUMS & CORE TYPES
// ==========================================

export const RequisitionStatusEnum = z.enum([
  "DRAFT",
  "SUBMITTED",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "CHANGES_REQUESTED",
  "CONVERTED_TO_PO",
  "CANCELLED",
]);
export type RequisitionStatus = z.infer<typeof RequisitionStatusEnum>;

export const PurchaseOrderStatusEnum = z.enum([
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "PARTIALLY_RECEIVED",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
]);
export type PurchaseOrderStatus = z.infer<typeof PurchaseOrderStatusEnum>;

export const GoodsReceiptStatusEnum = z.enum([
  "DRAFT",
  "RECEIVED",
  "PARTIALLY_RETURNED",
  "FULLY_RETURNED",
  "CANCELLED",
]);
export type GoodsReceiptStatus = z.infer<typeof GoodsReceiptStatusEnum>;

export const PurchaseReturnStatusEnum = z.enum([
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
]);
export type PurchaseReturnStatus = z.infer<typeof PurchaseReturnStatusEnum>;

export const SupplierPaymentStatusEnum = z.enum([
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
]);
export type SupplierPaymentStatus = z.infer<typeof SupplierPaymentStatusEnum>;

export const RequestTypeEnum = z.enum(["LOCAL", "IMPORT", "INTER_BRANCH", "URGENT"]);
export type RequestType = z.infer<typeof RequestTypeEnum>;

export const PurchaseMethodEnum = z.enum(["DIRECT", "QUOTATION", "TENDER", "CONTRACT"]);
export type PurchaseMethod = z.infer<typeof PurchaseMethodEnum>;

// ==========================================
// 2. MASTER DATA CONTEXT CONTRACTS
// ==========================================

export const CompanyContextSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  currency: z.string().default("BDT"),
});
export type CompanyContext = z.infer<typeof CompanyContextSchema>;

export const OfficeSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  address: z.string().optional(),
});
export type Office = z.infer<typeof OfficeSchema>;

export const WarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  officeId: z.string(),
});
export type Warehouse = z.infer<typeof WarehouseSchema>;

export const SupplierSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  contactPerson: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxNumber: z.string().optional(),
  type: z.enum(["LOCAL", "FOREIGN"]).default("LOCAL"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  balance: z.number().default(0),
});
export type Supplier = z.infer<typeof SupplierSchema>;

export const ItemSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  category: z.string(),
  uom: z.string(),
  standardPrice: z.number().default(0),
  description: z.string().optional(),
});
export type Item = z.infer<typeof ItemSchema>;

// ==========================================
// 3. PURCHASE REQUISITION CONTRACTS
// ==========================================

export const RequisitionItemSchema = z.object({
  id: z.string().optional(),
  itemId: z.string().min(1, "Item is required"),
  itemCode: z.string(),
  itemName: z.string(),
  uom: z.string(),
  quantity: z.number().positive("Quantity must be greater than 0"),
  estimatedUnitPrice: z.number().nonnegative("Estimated price must be non-negative"),
  lineTotal: z.number().nonnegative(),
  remarks: z.string().optional(),
});
export type RequisitionItem = z.infer<typeof RequisitionItemSchema>;

export const CreateRequisitionSchema = z.object({
  companyId: z.string().default("comp-bridgeone-01"),
  officeId: z.string().min(1, "Office is required"),
  warehouseId: z.string().min(1, "Warehouse is required"),
  requestType: RequestTypeEnum.default("LOCAL"),
  department: z.string().min(1, "Department is required"),
  section: z.string().optional(),
  requesterName: z.string().min(1, "Requester is required"),
  purchaseMethod: PurchaseMethodEnum.default("DIRECT"),
  requestDate: z.string().min(1, "Request date is required"),
  requiredDeliveryDate: z.string().min(1, "Required delivery date is required"),
  businessJustification: z.string().min(3, "Justification is required"),
  remarks: z.string().optional(),
  items: z.array(RequisitionItemSchema).min(1, "At least one item is required"),
});
export type CreateRequisitionInput = z.infer<typeof CreateRequisitionSchema>;

export const PurchaseRequisitionSchema = CreateRequisitionSchema.extend({
  id: z.string(),
  requisitionNumber: z.string(),
  referenceDocument: z.string().optional(),
  totalEstimatedAmount: z.number(),
  status: RequisitionStatusEnum,
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  approvalHistory: z.array(
    z.object({
      id: z.string(),
      action: z.string(),
      actorName: z.string(),
      comments: z.string().optional(),
      timestamp: z.string(),
    })
  ).default([]),
});
export type PurchaseRequisition = z.infer<typeof PurchaseRequisitionSchema>;

// ==========================================
// 4. PURCHASE ORDER CONTRACTS
// ==========================================

export const PurchaseOrderItemSchema = z.object({
  id: z.string().optional(),
  itemId: z.string().min(1, "Item is required"),
  itemCode: z.string(),
  itemName: z.string(),
  uom: z.string(),
  orderedQuantity: z.number().positive(),
  receivedQuantity: z.number().default(0),
  returnedQuantity: z.number().default(0),
  outstandingQuantity: z.number().default(0),
  unitPrice: z.number().nonnegative(),
  discountPercentage: z.number().min(0).max(100).default(0),
  discountAmount: z.number().default(0),
  taxPercentage: z.number().min(0).max(100).default(0),
  taxAmount: z.number().default(0),
  lineTotal: z.number().nonnegative(),
  remarks: z.string().optional(),
});
export type PurchaseOrderItem = z.infer<typeof PurchaseOrderItemSchema>;

export const CreatePurchaseOrderSchema = z.object({
  companyId: z.string().default("comp-bridgeone-01"),
  requisitionId: z.string().optional(),
  supplierId: z.string().min(1, "Supplier is required"),
  officeId: z.string().min(1, "Office is required"),
  warehouseId: z.string().min(1, "Warehouse is required"),
  projectCostCenter: z.string().optional(),
  orderDate: z.string().min(1, "Order date is required"),
  expectedDeliveryDate: z.string().min(1, "Expected delivery date is required"),
  referenceNumber: z.string().optional(),
  paymentTerms: z.string().default("Net 30 Days"),
  deliveryTerms: z.string().default("FOB Warehouse"),
  shippingFee: z.number().default(0),
  notes: z.string().optional(),
  items: z.array(PurchaseOrderItemSchema).min(1, "At least one item is required"),
});
export type CreatePurchaseOrderInput = z.infer<typeof CreatePurchaseOrderSchema>;

export const PurchaseOrderSchema = CreatePurchaseOrderSchema.extend({
  id: z.string(),
  poNumber: z.string(),
  supplierName: z.string(),
  officeName: z.string(),
  warehouseName: z.string(),
  requisitionNumber: z.string().optional(),
  subtotal: z.number(),
  totalDiscount: z.number(),
  totalTax: z.number(),
  totalAmount: z.number(),
  status: PurchaseOrderStatusEnum,
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  approvalHistory: z.array(
    z.object({
      id: z.string(),
      action: z.string(),
      actorName: z.string(),
      comments: z.string().optional(),
      timestamp: z.string(),
    })
  ).default([]),
});
export type PurchaseOrder = z.infer<typeof PurchaseOrderSchema>;

// ==========================================
// 5. GOODS RECEIPT (GRN) CONTRACTS
// ==========================================

export const GoodsReceiptItemSchema = z.object({
  id: z.string().optional(),
  poItemId: z.string(),
  itemId: z.string(),
  itemCode: z.string(),
  itemName: z.string(),
  uom: z.string(),
  orderedQuantity: z.number(),
  previouslyReceivedQuantity: z.number().default(0),
  currentReceivedQuantity: z.number().min(0),
  rejectedDamagedQuantity: z.number().min(0).default(0),
  unitPrice: z.number(),
  lineTotal: z.number(),
  remarks: z.string().optional(),
});
export type GoodsReceiptItem = z.infer<typeof GoodsReceiptItemSchema>;

export const CreateGoodsReceiptSchema = z.object({
  companyId: z.string().default("comp-bridgeone-01"),
  purchaseOrderId: z.string().min(1, "Purchase Order is required"),
  receiptDate: z.string().min(1, "Receipt date is required"),
  shipmentNumber: z.string().optional(),
  shipmentDocumentNumber: z.string().optional(),
  vatChallanNumber: z.string().optional(),
  supplierInvoiceNumber: z.string().optional(),
  deliveryNoteNumber: z.string().optional(),
  remarks: z.string().optional(),
  items: z.array(GoodsReceiptItemSchema).min(1, "At least one receipt item is required"),
});
export type CreateGoodsReceiptInput = z.infer<typeof CreateGoodsReceiptSchema>;

export const GoodsReceiptSchema = CreateGoodsReceiptSchema.extend({
  id: z.string(),
  grnNumber: z.string(),
  poNumber: z.string(),
  poDate: z.string(),
  requisitionNumber: z.string().optional(),
  supplierId: z.string(),
  supplierName: z.string(),
  officeId: z.string(),
  officeName: z.string(),
  warehouseId: z.string(),
  warehouseName: z.string(),
  totalReceivedAmount: z.number(),
  status: GoodsReceiptStatusEnum,
  preparedBy: z.string(),
  createdAt: z.string(),
  stockMovementSyncStatus: z.enum(["SYNCED", "LIVE", "SIMULATED", "UNCONFIGURED"]).default("SIMULATED"),
});
export type GoodsReceipt = z.infer<typeof GoodsReceiptSchema>;

// ==========================================
// 6. PURCHASE RETURN CONTRACTS
// ==========================================

export const PurchaseReturnItemSchema = z.object({
  id: z.string().optional(),
  grnItemId: z.string(),
  itemId: z.string(),
  itemCode: z.string(),
  itemName: z.string(),
  uom: z.string(),
  receivedQuantity: z.number(),
  previouslyReturnedQuantity: z.number().default(0),
  eligibleReturnQuantity: z.number(),
  returnQuantity: z.number().positive("Return quantity must be greater than 0"),
  unitPrice: z.number(),
  lineTotal: z.number(),
  reason: z.string().min(1, "Return reason is required"),
  condition: z.enum(["DAMAGED", "DEFECTIVE", "WRONG_SPECIFICATION", "EXCESS", "EXPIRED"]),
});
export type PurchaseReturnItem = z.infer<typeof PurchaseReturnItemSchema>;

export const CreatePurchaseReturnSchema = z.object({
  companyId: z.string().default("comp-bridgeone-01"),
  goodsReceiptId: z.string().min(1, "Goods Receipt reference is required"),
  returnDate: z.string().min(1, "Return date is required"),
  returnType: z.enum(["REPLACEMENT", "REFUND_CREDIT", "REPAIR"]).default("REFUND_CREDIT"),
  remarks: z.string().optional(),
  items: z.array(PurchaseReturnItemSchema).min(1, "At least one return item is required"),
});
export type CreatePurchaseReturnInput = z.infer<typeof CreatePurchaseReturnSchema>;

export const PurchaseReturnSchema = CreatePurchaseReturnSchema.extend({
  id: z.string(),
  returnNumber: z.string(),
  grnNumber: z.string(),
  poNumber: z.string(),
  supplierId: z.string(),
  supplierName: z.string(),
  officeId: z.string(),
  officeName: z.string(),
  totalReturnAmount: z.number(),
  status: PurchaseReturnStatusEnum,
  createdBy: z.string(),
  createdAt: z.string(),
  inventoryReversalStatus: z.enum(["SYNCED", "LIVE", "SIMULATED", "UNCONFIGURED"]).default("SIMULATED"),
  financeCreditNoteStatus: z.enum(["SYNCED", "LIVE", "SIMULATED", "UNCONFIGURED"]).default("SIMULATED"),
});
export type PurchaseReturn = z.infer<typeof PurchaseReturnSchema>;

// ==========================================
// 7. SUPPLIER PAYMENT / PAYABLES CONTRACTS
// ==========================================

export const SupplierPaymentRecordSchema = z.object({
  id: z.string(),
  supplierId: z.string(),
  supplierCode: z.string(),
  supplierName: z.string(),
  mobileNumber: z.string().optional(),
  category: z.enum(["LOCAL", "FOREIGN"]),
  totalPurchasedAmount: z.number(),
  returnedAmount: z.number(),
  paidAmount: z.number(),
  dueAmount: z.number(),
  lastPaymentDate: z.string().optional(),
  paymentStatus: SupplierPaymentStatusEnum,
  openInvoicesCount: z.number().default(0),
  currency: z.string().default("BDT"),
});
export type SupplierPaymentRecord = z.infer<typeof SupplierPaymentRecordSchema>;

export const SupplierInvoiceItemSchema = z.object({
  id: z.string(),
  invoiceNumber: z.string(),
  poNumber: z.string(),
  grnNumber: z.string().optional(),
  supplierName: z.string(),
  invoiceDate: z.string(),
  dueDate: z.string(),
  totalAmount: z.number(),
  paidAmount: z.number(),
  dueAmount: z.number(),
  status: SupplierPaymentStatusEnum,
  type: z.enum(["LOCAL", "FOREIGN"]),
});
export type SupplierInvoiceItem = z.infer<typeof SupplierInvoiceItemSchema>;

// ==========================================
// 8. PURCHASE DASHBOARD & KPI CONTRACTS
// ==========================================

export const DashboardKpiMetricsSchema = z.object({
  totalRequisitions: z.number(),
  pendingApprovals: z.number(),
  approvedRequisitions: z.number(),
  openPurchaseOrders: z.number(),
  partiallyReceivedOrders: z.number(),
  completedOrders: z.number(),
  pendingSupplierInvoices: z.number(),
  totalSpendAmount: z.number(),
  totalOutstandingAmount: z.number(),
});
export type DashboardKpiMetrics = z.infer<typeof DashboardKpiMetricsSchema>;

export const DashboardAnalyticsSchema = z.object({
  kpis: DashboardKpiMetricsSchema,
  typeWisePurchase: z.array(z.object({ name: z.string(), value: z.number(), amount: z.number() })),
  warehouseWisePurchase: z.array(z.object({ warehouse: z.string(), amount: z.number(), count: z.number() })),
  monthlyExpenditure: z.array(z.object({ month: z.string(), expenditure: z.number(), budget: z.number() })),
  poStatusDistribution: z.array(z.object({ status: z.string(), count: z.number() })),
  topSuppliers: z.array(z.object({ supplier: z.string(), totalSpend: z.number(), poCount: z.number() })),
  topPurchasedItems: z.array(z.object({ item: z.string(), quantity: z.number(), amount: z.number() })),
  procurementCycleTimeDays: z.number(),
  pendingApprovalItems: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["REQUISITION", "ORDER", "RETURN"]),
      docNumber: z.string(),
      date: z.string(),
      requester: z.string(),
      amount: z.number(),
      status: z.string(),
    })
  ),
  isSampleData: z.boolean().default(false),
});
export type DashboardAnalytics = z.infer<typeof DashboardAnalyticsSchema>;

// ==========================================
// 9. PURCHASE REPORTS CONTRACTS
// ==========================================

export const ReportQuerySchema = z.object({
  reportType: z.enum([
    "REQUISITION_REPORT",
    "PURCHASE_ORDER_REPORT",
    "GOODS_RECEIPT_REPORT",
    "PURCHASE_RETURN_REPORT",
    "SUPPLIER_PAYMENT_STATUS_REPORT",
    "SUPPLIER_PURCHASE_REPORT",
    "ITEM_PURCHASE_REPORT",
    "OFFICE_WAREHOUSE_PURCHASE_REPORT",
    "EXPENDITURE_SUMMARY_REPORT",
  ]),
  officeId: z.string().optional(),
  supplierId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  status: z.string().optional(),
  isSummary: z.boolean().default(false),
});
export type ReportQuery = z.infer<typeof ReportQuerySchema>;

export const ReportResultSchema = z.object({
  reportType: z.string(),
  generatedAt: z.string(),
  filtersApplied: z.record(z.string(), z.any()),
  columns: z.array(z.string()),
  rows: z.array(z.record(z.string(), z.any())),
  summary: z.record(z.string(), z.any()).optional(),
  totalRecords: z.number(),
});
export type ReportResult = z.infer<typeof ReportResultSchema>;

// ==========================================
// 10. INTEGRATION ADAPTER CONTRACTS
// ==========================================

export interface ExternalModuleAdapterStatus {
  module: "INVENTORY" | "FINANCE" | "HR" | "AUTHENTICATION";
  status: "LIVE" | "SIMULATED" | "UNCONFIGURED";
  endpoint?: string;
  description: string;
  lastPingTimestamp?: string;
}

export interface StockMovementRequest {
  idempotencyKey: string;
  referenceType: "GOODS_RECEIPT" | "PURCHASE_RETURN";
  referenceId: string;
  warehouseId: string;
  items: Array<{
    itemId: string;
    quantity: number;
    uom: string;
    movementDirection: "INWARD" | "OUTWARD";
  }>;
}

export interface StockMovementResponse {
  success: boolean;
  transactionId?: string;
  message: string;
  adapterStatus: "LIVE" | "SIMULATED" | "UNCONFIGURED";
}

export interface FinancePayableSyncRequest {
  idempotencyKey: string;
  referenceType: "SUPPLIER_INVOICE" | "CREDIT_NOTE";
  referenceNumber: string;
  supplierId: string;
  amount: number;
  currency: string;
  dueDate?: string;
}

export interface FinancePayableSyncResponse {
  success: boolean;
  voucherNumber?: string;
  message: string;
  adapterStatus: "LIVE" | "SIMULATED" | "UNCONFIGURED";
}
