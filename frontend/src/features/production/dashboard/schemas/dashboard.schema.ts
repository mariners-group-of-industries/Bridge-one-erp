import { z } from "zod";

/** Query of GET /api/production/dashboard (shared by the route and the browser). */
export const productionDashboardQuerySchema = z
  .object({
    from: z.iso.date({ error: "From Date is required." }),
    to: z.iso.date({ error: "To Date is required." }),
    officeId: z.uuid().optional(),
  })
  .refine((query) => query.from <= query.to, { error: "From Date must be on or before To Date.", path: ["to"] });
export type ProductionDashboardQuery = z.input<typeof productionDashboardQuerySchema>;

export interface TopProducedItem {
  itemId: string;
  code: string;
  name: string;
  uom: string;
  qty: number;
}

export interface TopWorkCenter {
  workCenterId: string;
  code: string;
  name: string;
  qty: number;
  hours: number;
  /** Units per machine hour (null without hours). */
  productivity: number | null;
}

/** Output of one day that has posted entries. */
export interface DailyOutput {
  /** YYYY-MM-DD */
  date: string;
  qty: number;
  rejectQty: number;
}

export const DASHBOARD_ORDER_STATUSES = ["PENDING_APPROVAL", "APPROVED", "IN_PROGRESS", "CLOSED", "REJECTED", "CANCELLED"] as const;
export type DashboardOrderStatus = (typeof DASHBOARD_ORDER_STATUSES)[number];

export interface ProductionDashboard {
  from: string;
  to: string;
  /** Units produced in the range (rejects included). */
  volume: number;
  /** Good units: volume − rejects. */
  goodQty: number;
  rejectQty: number;
  /** rejectQty ÷ volume in % (null without output). */
  rejectRate: number | null;
  /** Machine hours booked in the range. */
  hours: number;
  /** volume ÷ hours (0 without hours). */
  productivity: number;
  entries: number;
  /** Material cost of the range at BOM rates: what the BOM allows and what was consumed. */
  standardCost: number;
  actualCost: number;
  /** actualCost − standardCost (positive = more material used than the BOM allows). */
  variance: number;
  /** Days with output, oldest first. */
  daily: DailyOutput[];
  orders: {
    /** Orders dated in the range, by status. */
    byStatus: Record<DashboardOrderStatus, number>;
    /** Approved and in-progress orders as of now, whatever their date. */
    open: { count: number; orderQty: number; producedQty: number };
    /** Orders waiting for approval as of now. */
    pendingApproval: number;
  };
  /** Active master data the actor can see. */
  masters: { workCenters: number; boms: number };
  topItems: TopProducedItem[];
  topWorkCenters: TopWorkCenter[];
}
