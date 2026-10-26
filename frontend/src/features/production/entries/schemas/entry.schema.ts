import { z } from "zod";
import type { OrderStatus } from "../../orders/schemas/order.schema";

export const SHIFTS = ["Morning", "Day", "Evening", "Night", "General"] as const;

const quantity = (label: string) =>
  z.number({ error: `${label} is required.` }).refine(Number.isFinite, { error: `${label} must be a number.` }).min(0, { error: `${label} cannot be negative.` }).max(9_999_999_999, { error: `${label} is too large.` });

const materialSchema = z
  .object({
    itemId: z.uuid(),
    actualQty: quantity("Actual consumed quantity"),
    wastageQty: quantity("Wastage").default(0),
    scrapQty: quantity("Scrap").default(0),
  })
  .refine((line) => line.wastageQty + line.scrapQty <= line.actualQty + 1e-9, {
    error: "Wastage and scrap are part of the consumed quantity and cannot exceed it.",
    path: ["wastageQty"],
  });

/** Body of POST /api/production/entries (shared by the route and the browser). */
export const entryInputSchema = z
  .object({
    orderId: z.uuid({ error: "Choose the production order." }),
    entryDate: z.iso.date({ error: "Production Entry Date is required." }),
    shift: z.enum(SHIFTS, { error: "Choose the shift." }),
    workCenterId: z.uuid().nullish(),
    departmentId: z.uuid().nullish(),
    departmentSectionId: z.uuid().nullish(),
    outputWarehouseId: z.uuid({ error: "Choose the finished goods warehouse." }),
    totalQty: quantity("Total QTY").gt(0, { error: "Total QTY must be more than 0." }),
    rejectQty: quantity("Reject QTY").default(0),
    hours: quantity("Machine hours").max(24, { error: "Machine hours cannot be over 24." }).default(0),
    remarks: z.string().trim().max(500, { error: "Remarks is too long." }).nullish(),
    materials: z.array(materialSchema).max(300),
  })
  .refine((input) => input.rejectQty <= input.totalQty, { error: "Reject QTY cannot be more than the Total QTY.", path: ["rejectQty"] })
  .refine((input) => !input.departmentSectionId || input.departmentId, { error: "Choose the department of this section.", path: ["departmentId"] })
  .refine((input) => new Set(input.materials.map((line) => line.itemId)).size === input.materials.length, {
    error: "A material is listed twice.",
    path: ["materials"],
  });
export type EntryInput = z.input<typeof entryInputSchema>;
export type ParsedEntryInput = z.output<typeof entryInputSchema>;

/** POST /api/production/entries/[id]/cancel body: stock and the order go back. */
export const entryCancelSchema = z.object({
  version: z.iso.datetime(),
  reason: z.string().trim().min(1, { error: "Give a reason." }).max(500, { error: "Reason is too long." }),
});

/** Filters of GET /api/production/entries. */
export const entryListQuerySchema = z
  .object({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    departmentId: z.uuid().optional(),
    departmentSectionId: z.uuid().optional(),
    status: z.enum(["POSTED", "CANCELLED"]).optional(),
    search: z.string().trim().max(100).optional(),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, { error: "From Date must be on or before To Date.", path: ["to"] });
export type EntryListQuery = z.input<typeof entryListQuerySchema>;

/** GET /api/production/entries/approved-orders?search: orders open for entries. */
export const queueQuerySchema = z.object({ search: z.string().trim().max(100).optional() });

export interface QueueRow {
  id: string;
  number: string;
  orderDate: string;
  itemCode: string;
  itemName: string;
  uom: string;
  bomName: string;
  orderQty: number;
  producedQty: number;
  remainingQty: number;
  status: OrderStatus;
  officeName: string;
  entryCount: number;
}

export interface EntryFormMaterial {
  itemId: string;
  code: string;
  name: string;
  uom: string;
  /** Standard consumption per unit of output (BOM, wastage included). */
  perUnit: number;
  rate: number;
  /** Stock in the order's warehouse. */
  stock: number;
}

/** GET /api/production/entries/form?orderId: everything the entry form needs. */
export interface EntryForm {
  order: QueueRow & {
    orderDate: string;
    officeId: string;
    sourceWarehouseId: string;
    sourceWarehouseName: string;
    workCenterId: string | null;
    salesOrderNumber: string | null;
    netWeightPerUnit: number;
  };
  materials: EntryFormMaterial[];
  workCenters: { id: string; code: string; name: string; departmentId: string | null; departmentSectionId: string | null }[];
  departments: { id: string; name: string }[];
  sections: { id: string; name: string; departmentId: string }[];
  warehouses: { id: string; name: string }[];
}

export interface EntryRow {
  id: string;
  number: string;
  entryDate: string;
  orderId: string;
  orderNumber: string;
  salesOrderNumber: string | null;
  departmentName: string | null;
  sectionName: string | null;
  workCenterName: string | null;
  shift: string | null;
  itemCode: string;
  itemName: string;
  uom: string;
  categoryName: string | null;
  subCategoryName: string | null;
  totalQty: number;
  rejectQty: number;
  excessQty: number;
  netQty: number;
  variance: number;
  netWeight: number;
  hours: number;
  status: "POSTED" | "CANCELLED";
  createdByName: string;
  updatedAt: string;
}

export interface EntryMaterialLine {
  itemId: string;
  code: string;
  name: string;
  uom: string;
  standardQty: number;
  actualQty: number;
  wastageQty: number;
  scrapQty: number;
  /** actual − standard. */
  varianceQty: number;
  rate: number;
}

export interface EntryDetail extends EntryRow {
  officeName: string;
  sourceWarehouseName: string;
  outputWarehouseName: string;
  standardCost: number;
  actualCost: number;
  remarks: string | null;
  cancelReason: string | null;
  cancelledByName: string | null;
  cancelledAt: string | null;
  createdAt: string;
  materials: EntryMaterialLine[];
  canCancel: boolean;
}
