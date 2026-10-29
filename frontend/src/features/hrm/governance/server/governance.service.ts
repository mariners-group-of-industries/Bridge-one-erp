import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { decideBonus, decideIncrement, listBonusRuns, listIncrements } from "../../compensation/server/compensation.service";
import { grossOf } from "../../payroll/server/payroll.service";
import { decideLeave, decideMovement, listLeaves, listMovements } from "../../self-service/leave-movement/server/leave-movement.service";
import { employeeScope, isoDate, money, requireHr, toDate } from "../../shared/hr-access";
import type { GridColumn, PendingKind, PendingList, PolicyFilter, PolicyGrid, PolicyTab } from "../types";

const LIMIT = 500;
const col = (key: string, label: string, align?: "right"): GridColumn => ({ key, label, ...(align ? { align } : {}) });
const EMPLOYEE_COLS = [col("code", "Employee Code"), col("name", "Employee Name"), col("office", "Office")];
const yesNo = (value: boolean) => (value ? "Yes" : "No");
const range = (filter: PolicyFilter) =>
  filter.fromDate || filter.toDate ? { ...(filter.fromDate ? { gte: toDate(filter.fromDate) } : {}), ...(filter.toDate ? { lte: toDate(filter.toDate) } : {}) } : undefined;

function employeeWhere(actor: Actor, filter: PolicyFilter): Prisma.EmployeeWhereInput {
  return { ...employeeScope(actor), ...(filter.officeId ? { officeId: filter.officeId } : {}), ...(filter.employeeId ? { id: filter.employeeId } : {}) };
}

const employeeInclude = { office: { select: { name: true } } } as const;
const base = (e: { employeeCode: string; name: string; office: { name: string } }) => ({ code: e.employeeCode, name: e.name, office: e.office.name });

const notStored = (label: string): PolicyGrid => ({ configured: false, note: `${label} is not set up in the ERP yet, so there is nothing to show.`, columns: [], rows: [] });

/** What the ERP stores for one Settings / Policies tab, narrowed by office, dates and employee. */
export async function policyGrid(actor: Actor, tab: PolicyTab, filter: PolicyFilter): Promise<PolicyGrid> {
  requireHr(actor);
  const employees = (where: Prisma.EmployeeWhereInput = {}) =>
    db().employee.findMany({ where: { ...employeeWhere(actor, filter), ...where }, orderBy: { employeeCode: "asc" }, take: LIMIT, include: { ...employeeInclude, salary: true } });

  switch (tab) {
    case "leave": {
      const dates = range(filter);
      const leaves = await db().leaveApplication.findMany({
        where: {
          employee: employeeWhere(actor, filter),
          ...(dates ? { AND: [dates.lte ? { fromDate: { lte: dates.lte } } : {}, dates.gte ? { toDate: { gte: dates.gte } } : {}] } : {}),
        },
        orderBy: { fromDate: "desc" },
        take: LIMIT,
        include: { employee: { include: employeeInclude } },
      });
      return {
        configured: true,
        note: "Yearly quotas: Casual 10, Sick 14, Earned 18, Maternity 112 days; Leave Without Pay has no limit.",
        columns: [...EMPLOYEE_COLS, col("leaveType", "Leave Type"), col("from", "From Date"), col("to", "To Date"), col("days", "Days", "right"), col("status", "Status")],
        rows: leaves.map((l) => ({ ...base(l.employee), leaveType: l.leaveType, from: isoDate(l.fromDate), to: isoDate(l.toDate), days: l.days, status: l.status })),
      };
    }
    case "salary": {
      const list = await employees();
      return {
        configured: true,
        columns: [...EMPLOYEE_COLS, col("salaryType", "Salary Type"), col("gross", "Gross Salary", "right"), col("mode", "Disbursement"), col("hold", "Salary Hold")],
        rows: list.map((e) => ({
          ...base(e),
          salaryType: e.salary?.salaryType === "day-basis" ? "Day basis" : e.salary ? "Regular" : "Not set",
          gross: money(grossOf(e.salary)),
          mode: e.salary?.disbursementMode ?? "—",
          hold: yesNo(e.holdSalary),
        })),
      };
    }
    case "bonus": {
      const runs = (await listBonusRuns(actor)).filter((r) => (!filter.fromDate || r.bonusDate >= filter.fromDate) && (!filter.toDate || r.bonusDate <= filter.toDate));
      return {
        configured: true,
        columns: [
          col("name", "Bonus"),
          col("office", "Office"),
          col("bonusDate", "Bonus Date"),
          col("percent", "% of Gross", "right"),
          col("service", "Min. Service (months)", "right"),
          col("employees", "Employees", "right"),
          col("total", "Total Amount", "right"),
          col("status", "Status"),
        ],
        rows: runs.map((r) => ({
          name: r.name,
          office: r.officeName,
          bonusDate: r.bonusDate,
          percent: r.percentOfGross,
          service: r.minServiceMonths,
          employees: r.employeeCount,
          total: r.totalAmount,
          status: r.status,
        })),
      };
    }
    case "overtime-setup":
    case "pf-setup": {
      const field = tab === "overtime-setup" ? "eligibleOT" : "eligiblePF";
      const list = await employees({ salary: { [field]: true } });
      return {
        configured: true,
        note: `Employees marked ${tab === "overtime-setup" ? "eligible for overtime" : "eligible for provident fund"} in Employee › Salary.`,
        columns: [...EMPLOYEE_COLS, col("designation", "Designation"), col("gross", "Gross Salary", "right")],
        rows: list.map((e) => ({ ...base(e), designation: e.designation ?? "—", gross: money(grossOf(e.salary)) })),
      };
    }
    case "employee-assign": {
      const list = await employees();
      return {
        configured: true,
        columns: [...EMPLOYEE_COLS, col("department", "Department"), col("designation", "Designation"), col("supervisor", "Supervisor"), col("lineManager", "Line Manager")],
        rows: list.map((e) => ({ ...base(e), department: e.department ?? "—", designation: e.designation ?? "—", supervisor: e.supervisor ?? "—", lineManager: e.lineManager ?? "—" })),
      };
    }
    case "policy": {
      const list = await employees();
      return {
        configured: true,
        columns: [...EMPLOYEE_COLS, col("policy", "Employee Policy"), col("category", "Service Category"), col("type", "Employee Type")],
        rows: list.map((e) => ({ ...base(e), policy: e.employeePolicy ?? "—", category: e.serviceCategory ?? "—", type: e.employeeType ?? "—" })),
      };
    }
    case "separation-setup": {
      const dates = range(filter);
      const list = await employees({ terminationDate: dates ?? { not: null } });
      return {
        configured: true,
        columns: [...EMPLOYEE_COLS, col("designation", "Designation"), col("joining", "Joining Date"), col("separation", "Separation Date")],
        rows: list.map((e) => ({ ...base(e), designation: e.designation ?? "—", joining: isoDate(e.joiningDate), separation: e.terminationDate ? isoDate(e.terminationDate) : "—" })),
      };
    }
    case "allowance": {
      const fromMonth = filter.fromDate?.slice(0, 7);
      const toMonth = filter.toDate?.slice(0, 7);
      const adjustments = await db().employeeSalaryAdjustment.findMany({
        where: { employee: employeeWhere(actor, filter), ...(toMonth ? { fromMonth: { lte: toMonth } } : {}), ...(fromMonth ? { toMonth: { gte: fromMonth } } : {}) },
        orderBy: { fromMonth: "desc" },
        take: LIMIT,
        include: { employee: { include: employeeInclude } },
      });
      return {
        configured: true,
        note: "Salary additions and deductions entered in Employee › Salary; payroll applies them in their months.",
        columns: [...EMPLOYEE_COLS, col("type", "Type"), col("fromMonth", "From Month"), col("toMonth", "To Month"), col("amount", "Amount", "right")],
        rows: adjustments.map((a) => ({ ...base(a.employee), type: a.type === "addition" ? "Addition" : "Deduction", fromMonth: a.fromMonth, toMonth: a.toMonth, amount: Number(a.amount) })),
      };
    }
    default:
      return notStored(tab.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()));
  }
}

// ─── Pending approval ─────────────────────────────────────────────────────────

const money2 = (value: number) => value.toFixed(2);

export async function pendingApprovals(actor: Actor, kind: PendingKind): Promise<PendingList> {
  requireHr(actor);
  switch (kind) {
    case "leave": {
      const rows = (await listLeaves(actor)).filter((r) => r.status === "Pending");
      return {
        columns: [
          col("employee", "Employee"),
          col("type", "Leave Type"),
          col("from", "From Date"),
          col("to", "To Date"),
          col("days", "Days", "right"),
          col("reason", "Reason"),
          col("applied", "Applied On"),
        ],
        rows: rows.map((r) => ({
          id: r.id,
          employee: `${r.employeeCode} — ${r.employeeName}`,
          type: r.leaveType,
          from: r.fromDate,
          to: r.toDate,
          days: r.days,
          reason: r.reason,
          applied: r.appliedAt.slice(0, 10),
        })),
      };
    }
    case "movement": {
      const rows = (await listMovements(actor)).filter((r) => r.status === "Pending");
      return {
        columns: [col("employee", "Employee"), col("type", "Type"), col("from", "From Date"), col("to", "To Date"), col("time", "Time"), col("location", "Location"), col("reason", "Reason")],
        rows: rows.map((r) => ({
          id: r.id,
          employee: `${r.employeeCode} — ${r.employeeName}`,
          type: r.movementType,
          from: r.fromDate,
          to: r.toDate,
          time: `${r.startTime}–${r.endTime}`,
          location: r.location,
          reason: r.reason,
        })),
      };
    }
    case "bonus": {
      const rows = await listBonusRuns(actor, "Pending");
      return {
        columns: [col("name", "Bonus"), col("office", "Office"), col("date", "Bonus Date"), col("employees", "Employees", "right"), col("total", "Total Amount", "right"), col("by", "Created By")],
        rows: rows.map((r) => ({ id: r.id, name: r.name, office: r.officeName, date: r.bonusDate, employees: r.employeeCount, total: money2(r.totalAmount), by: r.createdByName ?? "—" })),
      };
    }
    case "increment": {
      const rows = await listIncrements(actor, { status: "Pending" });
      return {
        columns: [
          col("employee", "Employee"),
          col("office", "Office"),
          col("effective", "Effective Date"),
          col("increment", "Increment", "right"),
          col("previous", "Present Gross", "right"),
          col("next", "New Gross", "right"),
        ],
        rows: rows.map((r) => ({
          id: r.id,
          employee: `${r.employeeCode} — ${r.employeeName}`,
          office: r.officeName,
          effective: r.effectiveDate,
          increment: r.incrementType === "Percent" ? `${r.value}%` : money2(r.value),
          previous: money2(r.previousGross),
          next: money2(r.newGross),
        })),
      };
    }
  }
}

export async function decidePending(actor: Actor, kind: PendingKind, id: string, status: "Approved" | "Rejected") {
  requireHr(actor);
  const decide = { leave: decideLeave, movement: decideMovement, bonus: decideBonus, increment: decideIncrement }[kind];
  await decide(actor, id, status);
}
