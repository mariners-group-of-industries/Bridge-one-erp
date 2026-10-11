import { z } from "zod";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Longest range the dashboard aggregates in one request. */
export const MAX_RANGE_DAYS = 366;

const isoDate = z.iso.date({ error: "Use a date in YYYY-MM-DD format." });

/** Query of GET /api/sales/dashboard (shared by the route and the browser). */
export const dashboardQuerySchema = z
  .object({
    from: isoDate,
    to: isoDate,
    businessUnitId: z.uuid().optional(),
  })
  .refine((query) => query.from <= query.to, { error: "From Date must be on or before To Date.", path: ["to"] })
  .refine((query) => (Date.parse(query.to) - Date.parse(query.from)) / DAY_MS < MAX_RANGE_DAYS, {
    error: `The date range can be at most ${MAX_RANGE_DAYS} days.`,
    path: ["from"],
  });

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

/** One row of a "Top 10" list. Amounts and quantities are net of returns. */
export interface RankedEntry {
  id: string;
  name: string;
  /** Secondary text, e.g. item code or designation. */
  detail?: string;
  amount: number;
  qty: number;
}

export interface TargetRow {
  salesPersonId: string;
  name: string;
  designation?: string;
  target: number;
  achieved: number;
}

export interface OverdueRow {
  customerId: string;
  name: string;
  /** Outstanding amount whose due date is before the as-of date. */
  overdue: number;
  /** Outstanding amount that is not yet overdue. */
  due: number;
}

export interface DueTodayRow {
  customerId: string;
  name: string;
  amount: number;
}

export interface SalesDashboard {
  from: string;
  to: string;
  totals: {
    /** Deliveries minus returns in the range. */
    sales: number;
    /** Deliveries minus returns from the first day of the To Date's month to the To Date. */
    monthSales: number;
    collection: number;
  };
  target: {
    /** Targets of every month the range touches. */
    target: number;
    achieved: number;
    salesPersons: TargetRow[];
  };
  /** Customer balances as of the To Date, largest overdue first. */
  overdue: OverdueRow[];
  /** Amounts falling due on the To Date. */
  dueToday: DueTodayRow[];
  topItems: RankedEntry[];
  topCustomers: RankedEntry[];
  topSalesPersons: RankedEntry[];
}
