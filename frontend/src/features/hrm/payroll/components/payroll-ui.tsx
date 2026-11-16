"use client";

import { AlertTriangle, ArrowDown, ArrowUp, ChevronsUpDown, CircleAlert, Eye } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { cn } from "@/lib/cn";
import { TABLE } from "@/features/configuration/entity-master-data/employee/components/kit";
import { formatDate, formatMoney, monthLabel } from "../../shared/hr-ui";
import { COMPONENT_CODES, type AttendanceSummary, type ExcludedEmployee, type LineSort, type PayrollBatchStatus, type PayrollLine, type PayrollLineDetail, type PayrollTotals, type TraceStep } from "../batch-types";

const STATUS_VARIANT: Record<PayrollBatchStatus, BadgeProps["variant"]> = {
  Draft: "neutral",
  "Under Processing": "warning",
  Approved: "success",
  Rejected: "danger",
  Cancelled: "neutral",
};

export function PayrollStatusBadge({ status }: { status: PayrollBatchStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className={cn(status === "Cancelled" && "line-through")}>
      {status}
    </Badge>
  );
}

/** BDT amount with two decimals; a dash when the component does not apply. */
export const bdt = (value: number | null | undefined) => (value == null ? "—" : formatMoney(value));
const PAY_METHODS: Record<string, string> = { cash: "Cash", bank: "Bank", mfs: "MFS", multiple: "Multiple", hold: "On hold" };
export const payMethodLabel = (mode: string) => PAY_METHODS[mode] ?? mode;

// ─── Notices ──────────────────────────────────────────────────────────────────

export function Callout({ tone, title, children, action }: { tone: "warning" | "danger" | "info"; title: string; children?: ReactNode; action?: ReactNode }) {
  const tones = { warning: "border-warning/30 bg-warning/10 text-warning", danger: "border-danger/30 bg-danger/10 text-danger", info: "border-accent-line bg-accent-soft text-accent-strong dark:text-accent" };
  const Icon = tone === "danger" ? CircleAlert : AlertTriangle;
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex flex-wrap items-start gap-3 rounded border px-3 py-2.5", tones[tone])}>
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1 text-[13px]">
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-0.5 text-ink-muted">{children}</div>}
      </div>
      {action}
    </div>
  );
}

// ─── Summary ──────────────────────────────────────────────────────────────────

function Stat({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 bg-surface px-4 py-3">
      <dt className="text-[11px] font-semibold tracking-wide text-ink-muted uppercase">{label}</dt>
      <dd className={cn("truncate text-sm font-semibold text-ink tabular-nums", strong && "text-base text-accent-strong dark:text-accent")}>{value}</dd>
    </div>
  );
}

export function PayrollSummary({ totals, status, eligibleCount, excluded }: { totals: PayrollTotals; status: ReactNode; eligibleCount: number; excluded: ExcludedEmployee[] }) {
  const reconciled = eligibleCount === totals.employees + excluded.length;
  return (
    <section aria-label="Payroll summary" className="rounded border border-line bg-surface shadow-xs">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-t bg-line sm:grid-cols-4 lg:grid-cols-8">
        <Stat label="Total Employees" value={totals.employees} />
        <Stat label="Total Gross" value={bdt(totals.gross)} />
        <Stat label="Total Basic" value={totals.basic ? bdt(totals.basic) : "—"} />
        <Stat label="Total Allowances" value={bdt(totals.allowances)} />
        <Stat label="Attendance Deductions" value={bdt(totals.attendanceDeduction)} />
        <Stat label="Other Deductions" value={bdt(totals.otherDeduction)} />
        <Stat label="Net Payable (BDT)" value={bdt(totals.net)} strong />
        <Stat label="Payroll Status" value={status} />
      </dl>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line px-4 py-2 text-xs text-ink-muted">
        <span className={cn("font-semibold", reconciled ? "text-success" : "text-danger")}>{reconciled ? "Reconciled" : "Not reconciled"}</span>
        <span className="tabular-nums">
          {eligibleCount} eligible = {totals.employees} in payroll + {excluded.length} left out
        </span>
        {excluded.length > 0 && (
          <details className="basis-full">
            <summary className="inline-flex min-h-6 cursor-pointer items-center font-medium text-accent-strong dark:text-accent">Employees left out ({excluded.length})</summary>
            <ul className="mt-1 grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
              {excluded.map((x) => (
                <li key={x.employeeId}>
                  <span className="font-mono font-semibold text-ink">{x.employeeCode}</span> {x.employeeName}: {x.reason}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}

// ─── Employee salary table ────────────────────────────────────────────────────

interface Column {
  label: string;
  title?: string;
  sort?: LineSort;
  align?: "right";
}

const COLUMNS: Column[] = [
  { label: "Joining Date" },
  { label: "Designation" },
  { label: "Dept.", title: "Department" },
  { label: "Gross", sort: "gross", align: "right" },
  { label: "Basic", align: "right" },
  { label: "HR", title: "House Rent", align: "right" },
  { label: "Medical", align: "right" },
  { label: "Transport", align: "right" },
  ...COMPONENT_CODES.map((code) => ({ label: code, title: code === "PFD" ? "Provident fund deduction (PF Setup)" : `Allowance with short code ${code}`, align: "right" as const })),
  { label: "Deduction", title: "Attendance + other deductions", sort: "deduction", align: "right" },
  { label: "Net Payable", sort: "net", align: "right" },
  { label: "Pay Method" },
];

const STICKY = "sticky z-[1] bg-surface group-hover:bg-grid-hover";

function SortHeader({ column, sort, dir, onSort, className }: { column: Column; sort?: LineSort; dir?: "asc" | "desc"; onSort?: (sort: LineSort) => void; className?: string }) {
  const active = column.sort && sort === column.sort;
  return (
    <th scope="col" title={column.title} aria-sort={active ? (dir === "desc" ? "descending" : "ascending") : undefined} className={cn(TABLE.th, column.align === "right" && "text-right", className)}>
      {column.sort && onSort ? (
        <button type="button" onClick={() => onSort(column.sort!)} className="inline-flex min-h-6 items-center gap-1 rounded uppercase hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2">
          {column.label}
          {active ? dir === "desc" ? <ArrowDown aria-hidden="true" className="size-3" /> : <ArrowUp aria-hidden="true" className="size-3" /> : <ChevronsUpDown aria-hidden="true" className="size-3 opacity-50" />}
        </button>
      ) : (
        column.label
      )}
    </th>
  );
}

export function SalaryTable({
  rows,
  loading,
  sort,
  dir,
  onSort,
  onOpen,
}: {
  rows: PayrollLine[];
  loading?: boolean;
  sort?: LineSort;
  dir?: "asc" | "desc";
  onSort?: (sort: LineSort) => void;
  onOpen: (row: PayrollLine) => void;
}) {
  const money = `${TABLE.td} text-right tabular-nums whitespace-nowrap`;
  return (
    <div className={cn(TABLE.wrap, "transition-opacity", loading && "opacity-60")} aria-busy={loading || undefined}>
      <table className={cn(TABLE.table, "min-w-max")}>
        <thead className={TABLE.head}>
          <tr>
            <SortHeader column={{ label: "SL", sort: "sl", align: "right" }} sort={sort} dir={dir} onSort={onSort} className="sticky left-0 z-[2] w-12 min-w-12 bg-grid-head" />
            <SortHeader column={{ label: "Code", sort: "code" }} sort={sort} dir={dir} onSort={onSort} className="sticky left-12 z-[2] w-24 min-w-24 bg-grid-head" />
            <SortHeader column={{ label: "Employee Name", sort: "name" }} sort={sort} dir={dir} onSort={onSort} className="left-36 z-[2] w-48 min-w-48 bg-grid-head sm:sticky" />
            {COLUMNS.map((c) => (
              <SortHeader key={c.label} column={c} sort={sort} dir={dir} onSort={onSort} />
            ))}
            <th scope="col" className={cn(TABLE.th, "text-center")}>
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.employeeId} className={cn(TABLE.row, "group")}>
              <td className={cn(TABLE.td, STICKY, "left-0 text-right text-ink-faint tabular-nums")}>{row.sl}</td>
              <td className={cn(TABLE.td, STICKY, "left-12 font-mono text-xs font-semibold whitespace-nowrap")}>{row.employeeCode}</td>
              <td className={cn(TABLE.td, "left-36 z-[1] max-w-48 bg-surface group-hover:bg-grid-hover sm:sticky")}>
                <span className="flex items-center gap-1.5">
                  <span className="truncate font-medium" title={row.employeeName}>
                    {row.employeeName}
                  </span>
                  {row.errors.length > 0 ? (
                    <CircleAlert aria-label={`${row.errors.length} error(s)`} className="size-3.5 shrink-0 text-danger" />
                  ) : row.warnings.length > 0 ? (
                    <AlertTriangle aria-label={`${row.warnings.length} warning(s)`} className="size-3.5 shrink-0 text-warning" />
                  ) : null}
                </span>
              </td>
              <td className={cn(TABLE.td, "whitespace-nowrap tabular-nums")}>{formatDate(row.joiningDate)}</td>
              <td className={cn(TABLE.td, "whitespace-nowrap")}>{row.designation || "—"}</td>
              <td className={cn(TABLE.td, "whitespace-nowrap")}>{row.department || "—"}</td>
              <td className={cn(money, "font-medium")}>{bdt(row.grossSalary)}</td>
              <td className={money}>{bdt(row.basic)}</td>
              <td className={money}>{bdt(row.houseRent)}</td>
              <td className={money}>{bdt(row.medical)}</td>
              <td className={money}>{bdt(row.transport)}</td>
              {COMPONENT_CODES.map((code) => (
                <td key={code} className={money}>
                  {bdt(row.components[code])}
                </td>
              ))}
              <td className={cn(money, row.totalDeduction > 0 && "text-danger")}>{bdt(row.totalDeduction)}</td>
              <td className={cn(money, "font-semibold")}>{bdt(row.netPayable)}</td>
              <td className={cn(TABLE.td, "whitespace-nowrap")}>{payMethodLabel(row.payMethod)}</td>
              <td className={cn(TABLE.td, "px-1 py-1 text-center")}>
                <Button variant="ghost" size="icon" className="hover:text-accent-strong" title="Salary details" aria-label={`Salary details of ${row.employeeName}`} onClick={() => onOpen(row)}>
                  <Eye />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Employee salary details ──────────────────────────────────────────────────

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-1.5 last:border-b-0">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-[13px] font-medium text-ink tabular-nums">{value}</dd>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded border border-line">
      <h3 className="border-b border-line bg-canvas px-3 py-1.5 text-[11px] font-bold tracking-wide text-ink-muted uppercase">{title}</h3>
      <div className="px-3 py-1">{children}</div>
    </section>
  );
}

function AttendanceBlock({ a }: { a: AttendanceSummary }) {
  const leave = Object.entries(a.leaveDays);
  return (
    <Block title="Calendar & attendance">
      <dl>
        <Fact label="Days employed in the month" value={`${a.employedDays} of ${a.periodDays}`} />
        <Fact label="Assigned working days" value={a.workingDays} />
        <Fact label="Present days" value={a.presentDays} />
        <Fact label="Absent days" value={a.absentDays} />
        <Fact label="Working days without punch or leave" value={a.unrecordedDays} />
        {leave.length === 0 ? <Fact label="Leave days" value={0} /> : leave.map(([type, n]) => <Fact key={type} label={`Leave: ${type}`} value={n} />)}
        <Fact label="Weekly holidays" value={a.weeklyOffDays} />
        <Fact label="Public holidays" value={a.holidayDays} />
        <Fact label="Late attendance count" value={a.lateCount} />
        {a.unassignedDays > 0 && <Fact label="Days without a calendar" value={a.unassignedDays} />}
        {a.futureDays > 0 && <Fact label="Future days (month not over)" value={a.futureDays} />}
        {a.offDaysWorked > 0 && <Fact label="Off days / holidays worked" value={a.offDaysWorked} />}
      </dl>
    </Block>
  );
}

const SIGN: Record<TraceStep["kind"], string> = { "+": "+", "-": "−", "=": "=", i: "" };

function Trace({ steps }: { steps: TraceStep[] }) {
  return (
    <Block title="Calculation trace (read-only)">
      <ol className="divide-y divide-line">
        {steps.map((s, i) => (
          <li key={i} className={cn("grid grid-cols-[1.25rem_1fr_auto] items-baseline gap-x-2 py-1.5", s.kind === "=" && "font-semibold")}>
            <span aria-hidden="true" className={cn("text-center text-[13px] tabular-nums", s.kind === "-" ? "text-danger" : s.kind === "+" ? "text-success" : "text-ink-faint")}>
              {SIGN[s.kind] || "·"}
            </span>
            <span className="min-w-0">
              <span className="text-[13px] text-ink">{s.label}</span>
              <span className="block text-xs font-normal text-ink-muted">{s.detail}</span>
            </span>
            <span className={cn("text-[13px] tabular-nums", s.kind === "-" ? "text-danger" : "text-ink")}>{s.amount == null ? "" : bdt(s.amount)}</span>
          </li>
        ))}
      </ol>
    </Block>
  );
}

export function SalaryDetailDialog({
  open,
  month,
  line,
  loading,
  error,
  onClose,
}: {
  open: boolean;
  month: string;
  line: PayrollLineDetail | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      size="xl"
      title={line ? `${line.employeeName} (${line.employeeCode})` : "Salary details"}
      description={line ? `${[line.designation, line.department].filter(Boolean).join(" · ") || "Employee"} · Joined ${formatDate(line.joiningDate)} · Salary for ${monthLabel(month)}` : undefined}
      onClose={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {error ? (
        <ErrorState message={error} />
      ) : loading || !line ? (
        <LoadingState label="Loading salary details…" />
      ) : (
        <div className="flex flex-col gap-3">
          {line.errors.length > 0 && (
            <Callout tone="danger" title="This salary cannot be submitted yet">
              <ul className="list-disc pl-4">
                {line.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Callout>
          )}
          {line.warnings.length > 0 && (
            <Callout tone="warning" title="Calculation remarks">
              <ul className="list-disc pl-4">
                {line.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Callout>
          )}
          <div className="grid gap-3 lg:grid-cols-3">
            <Block title="Salary components (monthly)">
              <dl>
                <Fact label="Gross" value={bdt(line.grossSalary)} />
                <Fact label="Basic" value={bdt(line.basic)} />
                <Fact label="House Rent" value={bdt(line.houseRent)} />
                <Fact label="Medical" value={bdt(line.medical)} />
                <Fact label="Transport" value={bdt(line.transport)} />
                {COMPONENT_CODES.filter((code) => line.components[code] != null).map((code) => (
                  <Fact key={code} label={code} value={bdt(line.components[code])} />
                ))}
              </dl>
            </Block>
            <AttendanceBlock a={line.attendance} />
            <Block title="Deductions & net payable">
              <dl>
                <Fact label="Absent days deducted" value={line.attendance.absentDeductionDays} />
                <Fact label="Unpaid leave days deducted" value={line.attendance.unpaidLeaveDeductionDays} />
                <Fact label="Late deduction days" value={line.attendance.lateDeductionDays} />
                <Fact label="Attendance deductions" value={bdt(line.attendanceDeduction)} />
                <Fact label="Other authorized deductions" value={bdt(line.otherDeduction)} />
                <Fact label="Gross earned salary" value={bdt(line.earnedGross)} />
                <Fact label="Additions & allowances" value={bdt(line.additions)} />
                <Fact label="Total deductions" value={bdt(line.totalDeduction)} />
                <Fact label="Net payable (BDT)" value={<span className="text-sm font-bold text-accent-strong dark:text-accent">{bdt(line.netPayable)}</span>} />
                <Fact label="Payment method" value={[payMethodLabel(line.payMethod), line.bankOrProvider, line.accountNo].filter(Boolean).join(" · ")} />
              </dl>
            </Block>
          </div>
          <Trace steps={line.trace} />
        </div>
      )}
    </Dialog>
  );
}

// ─── Confirmation with optional remarks ───────────────────────────────────────

export function ActionDialog({
  open,
  title,
  children,
  confirmLabel,
  variant = "primary",
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  variant?: "primary" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={busy ? () => undefined : onClose}
      onSubmit={(event) => {
        event.preventDefault();
        onConfirm();
      }}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant={variant} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm text-ink-muted">{children}</div>
    </Dialog>
  );
}
