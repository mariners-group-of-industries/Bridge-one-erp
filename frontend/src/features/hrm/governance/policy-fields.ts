import { z } from "zod";
import type { PolicyTab } from "./types";

/**
 * Fields of each HR Governance › Settings / Policies tab. The create form, the
 * list columns and the server-side validation are all built from these, and the
 * values are stored in HrPolicyRecord.data.
 */

export const WEEKDAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

export type PolicyFieldType = "text" | "textarea" | "number" | "percent" | "time" | "date" | "select" | "checkbox" | "weekdays" | "ref" | "lines";

export interface PolicyField {
  key: string;
  label: string;
  type: PolicyFieldType;
  required?: boolean;
  options?: readonly string[];
  /** For "ref": the tab whose records' `name` values are offered. */
  refTab?: PolicyTab;
  /** For "number": whole numbers only, and bounds. */
  integer?: boolean;
  min?: number;
  max?: number;
  /** For "lines": the columns of each line (text, date, select or number). */
  lineFields?: PolicyField[];
  hint?: string;
}

/** Which of the common columns a tab uses; `true` = optional, "required" = must be set. */
export interface PolicyScope {
  office?: boolean | "required";
  employee?: boolean | "required";
  from?: boolean | "required";
  to?: boolean | "required";
  /** Labels for the common columns. */
  officeLabel?: string;
  fromLabel?: string;
  toLabel?: string;
}

/**
 * A list column: "@office", "@employee", "@from", "@to", a field key, or
 * "days:<Weekday>" (a tick for one day of a weekdays field named `days`).
 */
export interface PolicyColumn {
  key: string;
  label?: string;
}

export interface PolicyTabDef {
  description: string;
  /** Text of the create button, e.g. "Create Holiday". */
  createLabel: string;
  /** Name of one record in messages, e.g. "holiday group". */
  noun: string;
  scope: PolicyScope;
  /** Form fields, in the order shown (after the common ones). */
  fields: PolicyField[];
  /** List columns, in order, after SL and Action. */
  columns: PolicyColumn[];
  /** Extra checks across fields; returns an error message. */
  check?: (data: Record<string, PolicyValue>, record: { effectiveFrom: string; effectiveTo: string }) => string | null;
}

const text = (key: string, label: string, extra: Partial<PolicyField> = {}): PolicyField => ({ key, label, type: "text", ...extra });
const num = (key: string, label: string, extra: Partial<PolicyField> = {}): PolicyField => ({ key, label, type: "number", ...extra });
const pct = (key: string, label: string, extra: Partial<PolicyField> = {}): PolicyField => ({ key, label, type: "percent", ...extra });
const time = (key: string, label: string, extra: Partial<PolicyField> = {}): PolicyField => ({ key, label, type: "time", ...extra });
const date = (key: string, label: string, extra: Partial<PolicyField> = {}): PolicyField => ({ key, label, type: "date", ...extra });
const pick = (key: string, label: string, options: readonly string[], extra: Partial<PolicyField> = {}): PolicyField => ({ key, label, type: "select", options, ...extra });
const flag = (key: string, label: string, extra: Partial<PolicyField> = {}): PolicyField => ({ key, label, type: "checkbox", ...extra });
const note = (key: string, label: string, extra: Partial<PolicyField> = {}): PolicyField => ({ key, label, type: "textarea", ...extra });
const ref = (key: string, label: string, refTab: PolicyTab, extra: Partial<PolicyField> = {}): PolicyField => ({ key, label, type: "ref", refTab, ...extra });
const cols = (...keys: (string | [string, string])[]): PolicyColumn[] => keys.map((k) => (Array.isArray(k) ? { key: k[0], label: k[1] } : { key: k }));

const minutes = (hhmm: unknown) => (typeof hhmm === "string" && /^\d{2}:\d{2}$/.test(hhmm) ? Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)) : null);

export const POLICY_TAB_DEFS: Record<PolicyTab, PolicyTabDef> = {
  "attendance-process": {
    description: "How the first punch of the day becomes Present, Late or Absent in Daily Attendance. The office's own rule wins over an all-office rule.",
    createLabel: "Create Attendance Rule",
    noun: "attendance rule",
    scope: { office: true, from: "required" },
    fields: [
      time("dayStart", "Attendance Starts", { required: true, hint: "Earlier punches still count as on time." }),
      time("lateAfter", "Late After", { required: true, hint: "A first punch after this is Late." }),
      time("absentAfter", "Absent After", { required: true, hint: "A first punch after this is Absent." }),
      num("minWorkHours", "Min. Work Hour"),
    ],
    columns: cols("@office", ["@from", "Effective Date"], "dayStart", "lateAfter", "absentAfter", "minWorkHours"),
    check: (data) => {
      const [start, late, absent] = [minutes(data.dayStart), minutes(data.lateAfter), minutes(data.absentAfter)];
      if (start !== null && late !== null && late < start) return "Late After cannot be before Attendance Starts.";
      if (late !== null && absent !== null && absent <= late) return "Absent After must be later than Late After.";
      return null;
    },
  },
  holidays: {
    description: "Holiday groups: the holidays of one year for an office.",
    createLabel: "Create Holiday",
    noun: "holiday group",
    scope: { office: true },
    fields: [
      text("name", "Holiday Group Name", { required: true }),
      num("year", "Year", { required: true, integer: true, min: 2000, max: 2100 }),
      {
        key: "holidays",
        label: "Holidays",
        type: "lines",
        hint: "The days of this group (optional).",
        lineFields: [date("date", "Date", { required: true }), text("title", "Holiday", { required: true }), pick("holidayType", "Type", ["Public", "Religious", "Company", "Optional"], { required: true })],
      },
    ],
    columns: cols("@office", ["name", "Holiday Name"], "year"),
    check: (data) => {
      const year = String(data.year ?? "");
      const lines = (Array.isArray(data.holidays) ? data.holidays : []) as Record<string, string>[];
      const outside = lines.find((l) => l.date && !l.date.startsWith(`${year}-`));
      if (outside) return `${outside.date} is not in ${year}.`;
      const dates = lines.map((l) => l.date);
      const repeated = dates.find((d, i) => dates.indexOf(d) !== i);
      return repeated ? `${repeated} is listed twice.` : null;
    },
  },
  "calendar-setup": {
    description: "Work calendars (shifts) that employees and rosters are assigned to.",
    createLabel: "Create Calendar",
    noun: "calendar",
    scope: { office: true },
    fields: [
      text("name", "Calendar Name", { required: true }),
      text("shortCode", "Short Code", { required: true }),
      time("startTime", "Start Time", { required: true }),
      time("endTime", "End Time", { required: true }),
      num("minWorkHours", "Min. Work Hour", { required: true }),
      time("graceTime", "Grace Time", { hint: "Punching in after this is Late." }),
      time("lastStartTime", "Last Start Time", { hint: "Punching in after this is Absent." }),
      time("breakStartTime", "Break Start Time"),
      time("breakEndTime", "Break End Time"),
    ],
    columns: cols("@office", "name", "shortCode", "startTime", "endTime", "minWorkHours", "graceTime", "lastStartTime", "breakStartTime", "breakEndTime"),
    check: (data) => {
      const [start, end] = [minutes(data.breakStartTime), minutes(data.breakEndTime)];
      if ((start === null) !== (end === null)) return "Enter both Break Start Time and Break End Time, or neither.";
      return null;
    },
  },
  "off-day": {
    description: "Weekly off days of an office from an effective date.",
    createLabel: "Create Off Day",
    noun: "off day",
    scope: { office: true, from: "required", officeLabel: "Office Name", fromLabel: "Effective Date" },
    fields: [{ key: "days", label: "Off Days", type: "weekdays", required: true }],
    columns: cols("@from", "@office", ...WEEKDAYS.map((d) => [`days:${d}`, d] as [string, string])),
  },
  leave: {
    description: "Leave types with their yearly quota and carry-forward rules.",
    createLabel: "Create Leave Type",
    noun: "leave type",
    scope: { office: true, from: "required" },
    fields: [
      text("name", "Leave Type", { required: true }),
      text("shortCode", "Short Code", { required: true }),
      num("yearlyQuota", "Yearly Quota (days)", { required: true, integer: true }),
      pick("gender", "Applicable To", ["All", "Male", "Female"], { required: true }),
      flag("carryForward", "Carry forward unused days"),
      num("maxCarryDays", "Max. Carry Forward (days)", { integer: true }),
      flag("encashable", "Encashable"),
      flag("halfDayAllowed", "Half day allowed"),
    ],
    columns: cols("@office", "name", "shortCode", "yearlyQuota", "gender", "carryForward", "maxCarryDays", "encashable", ["@from", "Effective Date"]),
  },
  "sandwich-leave": {
    description: "Whether off days and holidays between leave days are counted as leave.",
    createLabel: "Create Sandwich Rule",
    noun: "sandwich rule",
    scope: { office: true, from: "required" },
    fields: [
      flag("countOffDays", "Count off days between leave days"),
      flag("countHolidays", "Count holidays between leave days"),
      text("leaveTypes", "Leave Types", { hint: "Comma separated; empty = every leave type." }),
    ],
    columns: cols(["@from", "Effective Date"], "@office", "countOffDays", "countHolidays", "leaveTypes"),
  },
  roster: {
    description: "Which calendar (shift) an employee works over a period.",
    createLabel: "Create Roster",
    noun: "roster",
    scope: { office: true, employee: "required", from: "required", to: true, fromLabel: "From Date", toLabel: "To Date" },
    fields: [
      ref("calendar", "Calendar", "calendar-setup", { required: true }),
      pick("pattern", "Pattern", ["Fixed", "Rotational"], { required: true }),
      ref("nextCalendar", "Rotate To Calendar", "calendar-setup", { hint: "Rotational rosters only." }),
      num("rotateEveryDays", "Rotate Every (days)", { integer: true, min: 1 }),
    ],
    columns: cols("@employee", "@office", "calendar", "pattern", "nextCalendar", "rotateEveryDays", "@from", "@to"),
  },
  salary: {
    description: "Salary structures: how gross salary is split into its components.",
    createLabel: "Create Salary Structure",
    noun: "salary structure",
    scope: { office: true, from: "required" },
    fields: [
      text("name", "Structure Name", { required: true }),
      pct("basicPercent", "Basic %", { required: true }),
      pct("houseRentPercent", "House Rent %"),
      pct("medicalPercent", "Medical %"),
      pct("conveyancePercent", "Conveyance %"),
      pct("foodPercent", "Food %"),
      pct("otherPercent", "Other %"),
    ],
    columns: cols("@office", "name", "basicPercent", "houseRentPercent", "medicalPercent", "conveyancePercent", "foodPercent", "otherPercent", ["@from", "Effective Date"]),
    check: (data) => {
      const total = ["basicPercent", "houseRentPercent", "medicalPercent", "conveyancePercent", "foodPercent", "otherPercent"].reduce((sum, k) => sum + (Number(data[k]) || 0), 0);
      return total > 100.0001 ? `The components add up to ${Math.round(total * 100) / 100}%; they cannot be more than 100%.` : null;
    },
  },
  "notice-board": {
    description: "Notices for employees, shown from the publish date until the expiry date.",
    createLabel: "Create Notice",
    noun: "notice",
    scope: { office: true, from: "required", to: true, fromLabel: "Publish Date", toLabel: "Expiry Date" },
    fields: [text("name", "Title", { required: true }), pick("priority", "Priority", ["Normal", "Important", "Urgent"], { required: true }), note("message", "Message", { required: true })],
    columns: cols("name", "priority", "@office", "@from", "@to"),
  },
  bonus: {
    description: "Bonus policies used when generating bonuses.",
    createLabel: "Create Bonus Policy",
    noun: "bonus policy",
    scope: { office: true, from: "required" },
    fields: [
      text("name", "Bonus Name", { required: true }),
      pick("festival", "Occasion", ["Eid-ul-Fitr", "Eid-ul-Adha", "Puja", "Christmas", "Performance", "Other"], { required: true }),
      pick("basis", "Basis", ["Gross", "Basic"], { required: true }),
      pct("percent", "Percent", { required: true }),
      num("minServiceMonths", "Min. Service (months)", { integer: true }),
      flag("proRata", "Pro-rata for shorter service"),
    ],
    columns: cols("@office", "name", "festival", "basis", "percent", "minServiceMonths", "proRata", ["@from", "Effective Date"]),
  },
  "overtime-setup": {
    description: "How overtime is paid.",
    createLabel: "Create Overtime Rule",
    noun: "overtime rule",
    scope: { office: true, from: "required" },
    fields: [
      pick("basis", "Rate Basis", ["Basic", "Gross"], { required: true }),
      num("multiplier", "Rate Multiplier", { required: true, hint: "2 = double the hourly rate." }),
      num("daysPerMonth", "Days per Month", { integer: true, hint: "Hourly rate = salary ÷ days ÷ hours." }),
      num("hoursPerDay", "Hours per Day"),
      num("minMinutes", "Min. OT (minutes)", { integer: true, hint: "Shorter overtime is not paid." }),
      num("maxHoursPerDay", "Max. OT Hours per Day"),
      num("maxHoursPerMonth", "Max. OT Hours per Month"),
    ],
    columns: cols("@office", "basis", "multiplier", "daysPerMonth", "hoursPerDay", "minMinutes", "maxHoursPerDay", "maxHoursPerMonth", ["@from", "Effective Date"]),
  },
  "separation-setup": {
    description: "Separation types with their notice period and settlement rules.",
    createLabel: "Create Separation Type",
    noun: "separation type",
    scope: { office: true },
    fields: [
      pick("name", "Separation Type", ["Resignation", "Termination", "Dismissal", "Retirement", "Contract End", "Death", "Other"], { required: true }),
      num("noticeDays", "Notice Period (days)", { integer: true }),
      num("settlementDays", "Final Settlement Within (days)", { integer: true }),
      num("gratuityYears", "Gratuity After (years)"),
      flag("leaveEncashment", "Pay unused leave"),
      note("remarks", "Remarks"),
    ],
    columns: cols("@office", "name", "noticeDays", "settlementDays", "gratuityYears", "leaveEncashment"),
  },
  allowance: {
    description: "Allowance types that can be given to employees in Allowance Setup.",
    createLabel: "Create Allowance",
    noun: "allowance",
    scope: {},
    fields: [
      text("name", "Allowance Name", { required: true }),
      text("shortCode", "Short Code"),
      pick("calculation", "Calculation", ["Fixed Amount", "% of Basic", "% of Gross"], { required: true }),
      flag("taxable", "Taxable"),
      flag("monthly", "Paid every month"),
      note("remarks", "Remarks"),
    ],
    columns: cols("name", "shortCode", "calculation", "taxable", "monthly"),
  },
  "allowance-setup": {
    description: "Allowances given to an employee over a period.",
    createLabel: "Assign Allowance",
    noun: "allowance assignment",
    scope: { office: true, employee: "required", from: "required", to: true, fromLabel: "From Date", toLabel: "To Date" },
    fields: [ref("allowance", "Allowance", "allowance", { required: true }), num("amount", "Amount / %", { required: true, hint: "An amount, or a percentage for % allowances." }), note("remarks", "Remarks")],
    columns: cols("@employee", "@office", "allowance", "amount", "@from", "@to"),
  },
  policy: {
    description: "Written HR policies.",
    createLabel: "Create Policy",
    noun: "policy",
    scope: { office: true, from: "required" },
    fields: [
      text("name", "Policy Name", { required: true }),
      pick("category", "Category", ["Attendance", "Leave", "Payroll", "Conduct", "Benefits", "Other"], { required: true }),
      note("description", "Description", { required: true }),
    ],
    columns: cols("@office", "name", "category", ["@from", "Effective Date"]),
  },
  "employee-assign": {
    description: "The calendar, off days and policy an employee follows.",
    createLabel: "Assign Employee",
    noun: "employee assignment",
    scope: { office: true, employee: "required", from: "required", to: true },
    fields: [ref("calendar", "Calendar", "calendar-setup", { required: true }), ref("holidayGroup", "Holiday Group", "holidays"), ref("policy", "Policy", "policy"), note("remarks", "Remarks")],
    columns: cols("@employee", "@office", "calendar", "holidayGroup", "policy", "@from", "@to"),
  },
  "pf-setup": {
    description: "Provident fund contribution rules.",
    createLabel: "Create PF Rule",
    noun: "PF rule",
    scope: { office: true, from: "required" },
    fields: [
      pick("basis", "Basis", ["Basic", "Gross"], { required: true }),
      pct("employeePercent", "Employee %", { required: true }),
      pct("employerPercent", "Employer %", { required: true }),
      num("eligibleAfterMonths", "Eligible After (months)", { integer: true }),
      num("vestingYears", "Vesting (years)"),
    ],
    columns: cols("@office", "basis", "employeePercent", "employerPercent", "eligibleAfterMonths", "vestingYears", ["@from", "Effective Date"]),
  },
  "late-punishment": {
    description: "How repeated late attendance is penalised.",
    createLabel: "Create Late Rule",
    noun: "late rule",
    scope: { office: true, from: "required" },
    fields: [
      num("latesAllowed", "Lates per Deduction", { required: true, integer: true, min: 1, hint: "e.g. 3 lates = 1 deduction." }),
      num("deductionDays", "Days Deducted", { required: true }),
      pick("deductFrom", "Deduct From", ["Leave Balance", "Salary"], { required: true }),
      flag("halfDayCounts", "Half days count as late"),
    ],
    columns: cols("@office", "latesAllowed", "deductionDays", "deductFrom", "halfDayCounts", ["@from", "Effective Date"]),
  },
  others: {
    description: "Any other HR setting.",
    createLabel: "Create Setting",
    noun: "setting",
    scope: { office: true, from: true },
    fields: [text("name", "Setting", { required: true }), text("value", "Value", { required: true }), note("description", "Description")],
    columns: cols("name", "value", "@office", ["@from", "Effective Date"]),
  },
};

export type PolicyLine = Record<string, string | number | null>;
export type PolicyValue = string | number | boolean | string[] | PolicyLine[] | null;

function fieldSchema(f: PolicyField): z.ZodType<PolicyValue> {
  const required = `${f.label} is required.`;
  const optional = <T extends PolicyValue>(s: z.ZodType<T>) => z.union([z.literal("").transform(() => null), z.null(), s]).optional().transform((v) => v ?? null);
  switch (f.type) {
    case "number":
    case "percent": {
      let n = z.coerce.number(`${f.label} must be a number.`).min(f.min ?? 0, `${f.label} cannot be less than ${f.min ?? 0}.`);
      n = f.type === "percent" ? n.max(100, `${f.label} cannot be more than 100.`) : n.max(f.max ?? 1_000_000_000, `${f.label} cannot be more than ${f.max ?? 1_000_000_000}.`);
      if (f.integer) n = n.int(`${f.label} must be a whole number.`);
      return f.required ? n : optional(n);
    }
    case "checkbox":
      return z.boolean().default(false);
    case "weekdays": {
      const days = z.array(z.enum(WEEKDAYS)).max(7);
      return f.required ? days.min(1, `Tick at least one of ${f.label}.`) : days.default([]);
    }
    case "time": {
      const t = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, `${f.label} must be a time.`);
      return f.required ? t : optional(t);
    }
    case "date": {
      const d = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${f.label} must be a date.`);
      return f.required ? d : optional(d);
    }
    case "select": {
      const options = z.enum(f.options as [string, ...string[]], `Choose a ${f.label}.`);
      return f.required ? options : optional(options);
    }
    case "lines": {
      const line = z.object(Object.fromEntries((f.lineFields ?? []).map((lf) => [lf.key, fieldSchema(lf)])));
      return z.array(line).max(200, `${f.label} can have at most 200 lines.`).default([]) as z.ZodType<PolicyValue>;
    }
    default: {
      const s = z.string(required).trim().max(f.type === "textarea" ? 2000 : 150, `${f.label} is too long.`);
      return f.required ? s.min(1, required) : z.union([z.null(), s]).optional().transform((v) => (v ? v : null));
    }
  }
}

/** Validates one record's `data` against the tab's fields; unknown keys are dropped. */
export function policyDataSchema(def: PolicyTabDef) {
  return z.object(Object.fromEntries(def.fields.map((f) => [f.key, fieldSchema(f)])));
}

export const policyRecordInputSchema = z.object({
  officeId: z.union([z.uuid(), z.literal("")]).default(""),
  employeeId: z.union([z.uuid(), z.literal("")]).default(""),
  effectiveFrom: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).default(""),
  effectiveTo: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).default(""),
  data: z.record(z.string(), z.unknown()).default({}),
});
export type PolicyRecordInput = z.input<typeof policyRecordInputSchema>;

export interface PolicyRecordRow {
  id: string;
  officeId: string;
  officeName: string | null;
  employeeId: string;
  employeeLabel: string | null;
  effectiveFrom: string;
  effectiveTo: string;
  data: Record<string, PolicyValue>;
  updatedByName: string | null;
  updatedAt: string;
}
