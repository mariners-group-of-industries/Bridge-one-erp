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

export interface ProductionDashboard {
  from: string;
  to: string;
  /** Units produced in the range. */
  volume: number;
  /** Machine hours booked in the range. */
  hours: number;
  /** volume ÷ hours (0 without hours). */
  productivity: number;
  entries: number;
  topItems: TopProducedItem[];
  topWorkCenters: TopWorkCenter[];
}
