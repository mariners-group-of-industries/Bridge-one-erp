import { z } from "zod";

/** Inventory pages and the document type each one keeps (URL slug → type). */
export const INVENTORY_DOC_TYPES = {
  "stock-adjustment": "STOCK_UPDATE",
  "transfer-request": "TRANSFER_REQUEST",
  transfer: "TRANSFER",
  "store-requisition": "STORE_REQUISITION",
  "store-issue": "STORE_ISSUE",
  "item-stock-conversion": "CONVERSION",
  "gate-in-out": "GATE_PASS",
} as const;

export type InventoryDocSlug = keyof typeof INVENTORY_DOC_TYPES;
export type InventoryDocType = (typeof INVENTORY_DOC_TYPES)[InventoryDocSlug];
export type InventoryDocStatus = "PENDING" | "APPROVED" | "REJECTED" | "IN_TRANSIT" | "COMPLETED" | "CANCELLED";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.");
const text = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);

export const inventoryLineSchema = z.object({
  itemId: z.uuid("Select an item."),
  qty: z.number().finite().refine((q) => q !== 0, "Quantity cannot be 0."),
  toItemId: z.uuid().optional(),
  toQty: z.number().finite().positive().optional(),
  remarks: text(300),
});

export const inventoryDocumentSchema = z.object({
  docDate: date,
  expectedDate: date.optional(),
  warehouseId: z.uuid().optional(),
  toWarehouseId: z.uuid().optional(),
  requestId: z.uuid().optional(),
  subtype: text(60),
  partyName: text(150),
  reference: text(100),
  remarks: text(500),
  meta: z.record(z.string(), z.string().max(200)).optional(),
  lines: z.array(inventoryLineSchema).max(200).default([]),
});
export type InventoryDocumentInput = z.infer<typeof inventoryDocumentSchema>;

export const reviewSchema = z.object({ comment: text(500) });

export const receiveSchema = z.object({
  receiveDate: date.optional(),
  lines: z.array(z.object({ lineId: z.uuid(), receivedQty: z.number().finite().min(0) })).min(1),
});

export interface InventoryDocumentLine {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  uom: string;
  category: string;
  qty: number;
  processedQty: number;
  toItemId: string | null;
  toItemCode: string | null;
  toItemName: string | null;
  toUom: string | null;
  toQty: number | null;
  remarks: string | null;
}

export interface WarehouseRef {
  id: string;
  name: string;
  officeName: string;
}

export interface InventoryDocument {
  id: string;
  type: InventoryDocType;
  number: string;
  docDate: string;
  expectedDate: string | null;
  status: InventoryDocStatus;
  subtype: string | null;
  partyName: string | null;
  reference: string | null;
  remarks: string | null;
  reviewComment: string | null;
  meta: Record<string, string> | null;
  createdBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  warehouse: WarehouseRef | null;
  toWarehouse: WarehouseRef | null;
  request: { id: string; number: string } | null;
  /** Transfers / issues made against this request: quantity sent and received. */
  fulfilments: { id: string; number: string; status: InventoryDocStatus; qty: number; receivedQty: number }[];
  lines: InventoryDocumentLine[];
  totalQty: number;
  processedQty: number;
}
