import { z } from "zod";

/** Statuses stored on an order. */
export const ORDER_STATUSES = ["PENDING_APPROVAL", "APPROVED", "IN_PROGRESS", "CLOSED", "REJECTED", "CANCELLED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
/**
 * Statuses shown and filtered on: IN_REVIEW is a pending order some approver has already
 * approved (a multi-stage pipeline part-way through).
 */
export const ORDER_VIEW_STATUSES = ["PENDING_APPROVAL", "APPROVED", "REJECTED", "CLOSED", "IN_PROGRESS", "IN_REVIEW", "CANCELLED"] as const;
export type OrderViewStatus = (typeof ORDER_VIEW_STATUSES)[number];
export const ORDER_STATUS_LABELS: Record<OrderViewStatus, string> = {
  PENDING_APPROVAL: "Pending",
  APPROVED: "Approved",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  CLOSED: "Closed",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

export const APPROVAL_STATUS_LABELS = { PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected" } as const;
export type ApprovalStatus = keyof typeof APPROVAL_STATUS_LABELS;
export const APPROVAL_ORDER_LABELS: Record<string, string> = { ANY: "Any_Person", SEQUENTIAL: "Sequential" };

/** Name of the feature in Configuration › Security › Approval Setup. */
export const ORDER_APPROVAL_FEATURE = "Production Order";

const optionalId = z.uuid().nullish();

/** Body of POST /api/production/orders and `data` of PUT (shared by the route and the browser). */
export const orderInputSchema = z
  .object({
    orderDate: z.iso.date({ error: "Order Date is required." }),
    productionDate: z.iso.date({ error: "Production Date is required." }),
    customerId: optionalId,
    salesOrderId: optionalId,
    customerPoNo: z.string().trim().max(60, { error: "Customer PO No is too long." }).nullish(),
    itemId: z.uuid({ error: "Produced Item is required." }),
    bomId: z.uuid({ error: "Bill Of Material is required." }),
    quantity: z
      .number({ error: "Quantity is required." })
      .refine(Number.isFinite, { error: "Quantity must be a number." })
      .gt(0, { error: "Quantity must be greater than 0." })
      .max(9_999_999_999, { error: "Quantity is too large." }),
    officeId: z.uuid({ error: "Office is required." }),
    warehouseId: z.uuid({ error: "Warehouse is required." }),
    workCenterId: optionalId,
    machineName: z.string().trim().max(100, { error: "Machine Name is too long." }).nullish(),
    narration: z.string().trim().max(500, { error: "Remarks is too long." }).nullish(),
  })
  .refine((input) => input.productionDate >= input.orderDate, { error: "Production Date cannot be before the Order Date.", path: ["productionDate"] })
  .refine((input) => !input.salesOrderId || input.customerId, { error: "Choose the customer of this sales order.", path: ["customerId"] });
export type OrderInput = z.input<typeof orderInputSchema>;
export type ParsedOrderInput = z.output<typeof orderInputSchema>;

/** PUT body: optimistic lock on `updatedAt`. Only orders nobody has approved yet. */
export const orderUpdateSchema = z.object({ version: z.iso.datetime(), data: orderInputSchema });
export type OrderUpdate = z.input<typeof orderUpdateSchema>;

export const ORDER_ACTIONS = ["approve", "reject", "start", "close", "cancel"] as const;
export type OrderAction = (typeof ORDER_ACTIONS)[number];

/** POST /api/production/orders/[id]/actions body. Reject and cancel need a reason. */
export const orderActionSchema = z
  .object({
    version: z.iso.datetime(),
    action: z.enum(ORDER_ACTIONS),
    comment: z.string().trim().max(500, { error: "Comment is too long." }).optional(),
  })
  .refine((input) => !["reject", "cancel"].includes(input.action) || !!input.comment, { error: "Give a reason.", path: ["comment"] });
export type OrderActionInput = z.input<typeof orderActionSchema>;

/** Filters of GET /api/production/orders. */
export const orderListQuerySchema = z
  .object({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    status: z.enum(ORDER_VIEW_STATUSES).optional(),
    bomId: z.uuid().optional(),
    search: z.string().trim().max(100).optional(),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, { error: "Start Date must be on or before End Date.", path: ["to"] });
export type OrderListQuery = z.input<typeof orderListQuerySchema>;

/** GET /api/production/orders/preview: the BOM exploded for a quantity. */
export const orderPreviewQuerySchema = z.object({
  bomId: z.uuid(),
  itemId: z.uuid(),
  quantity: z.coerce.number().gt(0).max(9_999_999_999),
  warehouseId: z.uuid().optional(),
});

/** GET /api/production/orders/customers?search=: customers by name or code (3+ letters). */
export const customerSearchSchema = z.object({ search: z.string().trim().min(3, { error: "Type at least 3 letters." }).max(100) });

export interface OrderPreviewMaterial {
  itemId: string;
  code: string;
  name: string;
  uom: string;
  bomQty: number;
  requiredQty: number;
  /** Stock in the chosen warehouse (null without one). */
  stock: number | null;
}

export interface OrderPreview {
  bomName: string;
  lotSize: number;
  /** Order quantity ÷ lot size. */
  factor: number;
  unitCost: number;
  totalCost: number;
  materials: OrderPreviewMaterial[];
}

export interface ProducibleItem {
  itemId: string;
  businessUnitId: string;
  code: string;
  name: string;
  uom: string;
  boms: { id: string; name: string; lotSize: number }[];
}

export interface OrderLookups {
  offices: { id: string; name: string; businessUnitId: string }[];
  warehouses: { id: string; name: string; officeId: string }[];
  workCenters: { id: string; code: string; name: string; businessUnitId: string; officeId: string | null }[];
  items: ProducibleItem[];
  boms: { id: string; name: string }[];
  /** Whether the user may approve / reject orders. */
  canApprove: boolean;
}

export interface CustomerOption {
  id: string;
  code: string;
  name: string;
}

export interface SalesOrderOption {
  id: string;
  number: string;
  orderDate: string;
  status: string;
  lines: { itemId: string; qty: number }[];
}

export interface OrderRow {
  id: string;
  number: string;
  orderDate: string;
  productionDate: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  uom: string;
  bomId: string;
  bomName: string;
  orderQty: number;
  producedQty: number;
  remainingQty: number;
  producedValue: number;
  status: OrderViewStatus;
  officeName: string;
  updatedAt: string;
}

export interface OrderMaterial {
  itemId: string;
  code: string;
  name: string;
  uom: string;
  bomQty: number;
  requiredQty: number;
  issueQty: number;
  usedQty: number;
  /** Required − used. */
  remainingQty: number;
  returnQty: number;
}

export interface OrderApproval {
  stageNo: number;
  stageName: string;
  approvalOrder: string;
  requiredCount: number;
  approverNames: string[];
  approvedNames: string[];
  status: ApprovalStatus;
  actedByName: string | null;
  comment: string | null;
  actedAt: string | null;
}

export interface OrderDetail extends OrderRow {
  businessUnitId: string;
  customerId: string | null;
  customerName: string | null;
  salesOrderId: string | null;
  salesOrderNumber: string | null;
  customerPoNo: string | null;
  officeId: string;
  warehouseId: string;
  warehouseName: string;
  workCenterId: string | null;
  workCenterName: string | null;
  machineName: string | null;
  narration: string | null;
  bomLotSize: number;
  unitCost: number;
  statusReason: string | null;
  createdByName: string;
  createdAt: string;
  materials: OrderMaterial[];
  approvals: OrderApproval[];
  /** Actions the current user may take now. */
  allowedActions: OrderAction[];
  canEdit: boolean;
}
