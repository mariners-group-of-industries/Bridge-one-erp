import { z } from "zod";

// HRM › Overtime. Shared by the page and the API.

export const OVERTIME_STATUSES = ["Pending", "Approved", "Rejected"] as const;
export type OvertimeStatus = (typeof OVERTIME_STATUSES)[number];
export type OvertimeSource = "Attendance" | "Manual";

/** Longest date range one calculation or list covers. */
export const MAX_RANGE_DAYS = 62;
/** Most overtime one person can claim for one day (sanity limit). */
export const MAX_MINUTES_PER_DAY = 16 * 60;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date.");
const uuid = z.uuid("Select a valid option.");
const DAY_MS = 86_400_000;

const range = <T extends { from: string; to: string }>(schema: z.ZodType<T>) =>
  schema
    .refine((q) => q.from <= q.to, { message: "From date must be on or before To date.", path: ["to"] })
    .refine((q) => (Date.parse(q.to) - Date.parse(q.from)) / DAY_MS < MAX_RANGE_DAYS, { message: `Choose at most ${MAX_RANGE_DAYS} days at a time.`, path: ["from"] });

/** GET /api/hrm/overtime/calculate */
export const calculateQuerySchema = range(z.object({ officeId: uuid, from: isoDate, to: isoDate }));
export type CalculateQuery = z.infer<typeof calculateQuerySchema>;

/** GET /api/hrm/overtime */
export const entryListQuerySchema = range(
  z.object({
    officeId: uuid.optional(),
    from: isoDate,
    to: isoDate,
    status: z.enum(OVERTIME_STATUSES).optional(),
  }),
);
export type EntryListQuery = z.infer<typeof entryListQuerySchema>;

/** GET /api/hrm/overtime/summary */
export const summaryQuerySchema = z.object({
  officeId: uuid,
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a month."),
});
export type SummaryQuery = z.infer<typeof summaryQuerySchema>;

const minutes = z.coerce
  .number({ message: "Enter the overtime." })
  .int("Overtime is counted in whole minutes.")
  .min(1, "Overtime must be more than 0.")
  .max(MAX_MINUTES_PER_DAY, `At most ${MAX_MINUTES_PER_DAY / 60} hours a day.`);
const hhmm = z.string().regex(/^\d{2}:\d{2}$/).optional();

/** POST /api/hrm/overtime: submit overtime for approval (from the calculation, or entered by hand). */
export const entryInputSchema = z.object({
  entries: z
    .array(
      z.object({
        employeeId: uuid,
        date: isoDate,
        minutes,
        source: z.enum(["Attendance", "Manual"]),
        inTime: hhmm,
        outTime: hhmm,
        workedMinutes: z.coerce.number().int().min(0).max(24 * 60).optional(),
        reason: z.string().trim().max(500).optional().default(""),
      }),
    )
    .min(1, "Select at least one day.")
    .max(2000),
});
export type EntryInput = z.input<typeof entryInputSchema>;

/** POST /api/hrm/overtime/approve | /reject */
export const decisionInputSchema = z.object({ ids: z.array(uuid).min(1, "Select at least one entry.").max(2000) });
export type DecisionInput = z.infer<typeof decisionInputSchema>;

// ─── DTOs ─────────────────────────────────────────────────────────────────────

/** The office's Overtime Setup rule in force (HR Settings › Overtime Setup), or the defaults. */
export interface OvertimeRule {
  basis: "Basic" | "Gross";
  multiplier: number;
  daysPerMonth: number;
  hoursPerDay: number;
  minMinutes: number;
  maxHoursPerDay: number | null;
  maxHoursPerMonth: number | null;
  /** False when no rule was set up and the defaults apply. */
  configured: boolean;
}

/** One employee-day of the calculation. */
export interface CalculatedDay {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  designation: string;
  date: string;
  day: string;
  /** Friday: a weekly off, so every worked minute is overtime. */
  offDay: boolean;
  inTime: string;
  outTime: string | null;
  workedMinutes: number;
  standardMinutes: number;
  /** Overtime after the rule (minimum and daily maximum). */
  overtimeMinutes: number;
  /** Already submitted for this day. */
  entry: { id: string; status: OvertimeStatus; minutes: number } | null;
}

export interface CalculationResult {
  rule: OvertimeRule;
  days: CalculatedDay[];
  /** OT-eligible employees of the office, for manual entries. */
  employees: { id: string; code: string; name: string; designation: string }[];
  /** Employees with punches who are not eligible for overtime (Employee › Salary). */
  notEligible: number;
}

export interface EntryRow {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  designation: string;
  officeName: string;
  date: string;
  minutes: number;
  source: OvertimeSource;
  inTime: string | null;
  outTime: string | null;
  workedMinutes: number | null;
  reason: string | null;
  status: OvertimeStatus;
  createdByName: string | null;
  decidedByName: string | null;
}

export interface SummaryRow {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  designation: string;
  /** The monthly salary the rate is worked out from. */
  rateSalary: number;
  /** "Basic", "Gross", or "Gross" when the rule asks for Basic but none is set. */
  rateBasis: "Basic" | "Gross";
  basicMissing: boolean;
  hourlyRate: number;
  approvedMinutes: number;
  /** Approved minutes after the monthly maximum. */
  payableMinutes: number;
  amount: number;
}

export interface SummaryResult {
  month: string;
  rule: OvertimeRule;
  rows: SummaryRow[];
  totals: { approvedMinutes: number; payableMinutes: number; amount: number };
  pendingCount: number;
}

/** 135 → "2:15" */
export const formatMinutes = (minutes: number | null | undefined) => {
  if (minutes == null) return "—";
  const sign = minutes < 0 ? "-" : "";
  const m = Math.abs(Math.round(minutes));
  return `${sign}${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
};

/** "2:15" or "2.25" → 135; null when it is not a duration. */
export function parseDuration(text: string): number | null {
  const value = text.trim();
  const clock = /^(\d{1,2}):([0-5]\d)$/.exec(value);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  if (/^\d+(\.\d+)?$/.test(value)) return Math.round(Number(value) * 60);
  return null;
}
