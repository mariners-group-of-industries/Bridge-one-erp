"use client";

import { FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useResource } from "@/hooks/use-resource";
import { apiRequest } from "@/lib/api/client";
import { resolveBreadcrumbs } from "@/lib/navigation/registry";
import { EmptyBlock, Notice, TABLE } from "@/features/configuration/entity-master-data/employee/components/kit";
import { Grid } from "../../self-service/leave-movement/components/shared";
import { hrmPaths } from "../../paths";
import { FilterBar, FilterField, MonthSelect, OfficeSelect, YearSelect, formatDate, formatMoney, monthLabel, useHrOptions } from "../../shared/hr-ui";
import { lastClosedPayrollMonth } from "../period";
import type { DisbursementLine, SalarySheet } from "../types";

const TABS = [
  { id: "advice", label: "Advice" },
  { id: "sheet", label: "Salary Generate Sheet" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const MODE: Record<string, string> = { cash: "Cash", bank: "Bank", mfs: "MFS", multiple: "Multiple", hold: "On hold" };
const td = TABLE.td;
const num = `${TABLE.td} text-right tabular-nums`;

export function SalaryDisbursementView({ initial }: { initial: { tab?: string; officeId?: string; month?: string } }) {
  const [tab, setTab] = useState<TabId>(initial.tab === "sheet" ? "sheet" : "advice");
  const options = useHrOptions();
  const period = /^\d{4}-\d{2}$/.test(initial.month ?? "") ? { year: initial.month!.slice(0, 4), month: initial.month!.slice(5, 7) } : lastClosedPayrollMonth();
  const [filter, setFilter] = useState({ officeId: initial.officeId ?? "", ...period });
  const [applied, setApplied] = useState(initial.officeId ? filter : null);
  const month = applied && `${applied.year}-${applied.month}`;
  const sheet = useResource(applied?.officeId ? `hrm-salary-sheet?${applied.officeId}&${month}` : null, () =>
    apiRequest<SalarySheet>(`/api/hrm/payroll/sheet?officeId=${applied!.officeId}&month=${month}`),
  );
  const [error, setError] = useState("");

  return (
    <PageContainer full>
      <PageHead title="Salary Disbursement" subtitle="Salary advice and generate sheet for an office and month." breadcrumbs={resolveBreadcrumbs(hrmPaths.salaryDisbursement).slice(1)} />
      <section className="rounded border border-line bg-surface shadow-xs">
        <Tabs tabs={TABS} value={tab} onChange={setTab} label="Salary disbursement">
          <div className="flex flex-col gap-3 p-4">
            <FilterBar
              busy={sheet.loading}
              onSubmit={() => {
                setError(filter.officeId ? "" : "Select an office.");
                if (filter.officeId) setApplied(filter);
              }}
            >
              <FilterField label="Office" width="w-64">
                {(id) => <OfficeSelect id={id} options={options.data} value={filter.officeId} allLabel="Select office…" onChange={(officeId) => setFilter((f) => ({ ...f, officeId }))} />}
              </FilterField>
              <FilterField label="Month" width="w-36">
                {(id) => <MonthSelect id={id} value={filter.month} onChange={(m) => setFilter((f) => ({ ...f, month: m }))} />}
              </FilterField>
              <FilterField label="Year" width="w-28">
                {(id) => <YearSelect id={id} value={filter.year} onChange={(year) => setFilter((f) => ({ ...f, year }))} />}
              </FilterField>
            </FilterBar>
            {error && <Notice tone="error">{error}</Notice>}

            {!applied ? (
              <EmptyBlock icon={<FileSpreadsheet />} title="Select an office, month and year, then View" />
            ) : sheet.error ? (
              <ErrorState message={sheet.error.message} onRetry={sheet.reload} />
            ) : !sheet.data ? (
              <LoadingState label="Loading salaries…" />
            ) : (
              <SheetBody tab={tab} sheet={sheet.data} loading={sheet.loading} />
            )}
          </div>
        </Tabs>
      </section>
    </PageContainer>
  );
}

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "neutral"> = { Approved: "success", "Under Processing": "warning", Draft: "neutral", Rejected: "danger" };

function SheetBody({ tab, sheet, loading }: { tab: TabId; sheet: SalarySheet; loading: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
        <span className="font-semibold text-ink">
          {sheet.officeName} · {monthLabel(sheet.month)}
        </span>
        <span className="tabular-nums">
          Period {formatDate(sheet.fromDate)} – {formatDate(sheet.toDate)}
        </span>
        <span>{sheet.businessUnit}</span>
        {sheet.batches.length === 0 ? (
          <Badge variant="warning">Not generated</Badge>
        ) : (
          sheet.batches.map((b) => (
            <Link key={b.id} href={hrmPaths.payrollBatch(b.id)} className="inline-flex min-h-6 items-center gap-1.5 hover:underline">
              <span className="font-mono font-semibold text-accent-strong dark:text-accent">{b.reference}</span>
              <Badge variant={STATUS_VARIANT[b.status] ?? "neutral"}>{b.status}</Badge>
              <span className="tabular-nums">pay date {formatDate(b.payrollDate)}</span>
            </Link>
          ))
        )}
        {sheet.withoutSalary > 0 && <span className="text-warning">{sheet.withoutSalary} employee(s) left out: no salary set.</span>}
      </div>
      {!sheet.final && (
        <Notice tone="error">
          {sheet.batches.length === 0
            ? "Provisional: calculated live from salaries, attendance (lates, absences) and HR policies. Generate and approve the payroll in Payroll to lock the figures."
            : "Provisional: the payroll is not approved yet, so these figures can still change."}
        </Notice>
      )}
      {sheet.lines.length === 0 ? (
        <EmptyBlock icon={<FileSpreadsheet />} title="No employees with a salary in this office for the month" />
      ) : tab === "advice" ? (
        <Advice lines={sheet.lines} total={sheet.totals.netAmount} loading={loading} />
      ) : (
        <GenerateSheet sheet={sheet} loading={loading} />
      )}
    </div>
  );
}

function Advice({ lines, total, loading }: { lines: DisbursementLine[]; total: number; loading: boolean }) {
  return (
    <Grid headers={["SL", "Employee Code", "Employee Name", "Designation", "Payment Mode", "Bank / MFS", "Account No", "Net Payable"]} loading={loading}>
      {lines.map((l, i) => (
        <tr key={l.employeeId} className={TABLE.row}>
          <td className={`${num} text-ink-faint`}>{i + 1}</td>
          <td className={`${td} tabular-nums`}>{l.employeeCode}</td>
          <td className={`${td} whitespace-nowrap`}>{l.employeeName}</td>
          <td className={td}>{l.designation ?? "—"}</td>
          <td className={td}>{MODE[l.disbursementMode] ?? l.disbursementMode}</td>
          <td className={td}>{l.bankOrProvider ?? "—"}</td>
          <td className={`${td} tabular-nums`}>{l.accountNo ?? "—"}</td>
          <td className={`${num} font-semibold`}>{formatMoney(l.netAmount)}</td>
        </tr>
      ))}
      <tr className="border-t-2 border-grid-head-rule bg-grid-head font-semibold">
        <td className={td} colSpan={7}>
          Total ({lines.length} employees)
        </td>
        <td className={num}>{formatMoney(total)}</td>
      </tr>
    </Grid>
  );
}

function GenerateSheet({ sheet, loading }: { sheet: SalarySheet; loading: boolean }) {
  const t = sheet.totals;
  return (
    <Grid
      headers={["SL", "Employee Code", "Employee Name", "Designation", "Period Days", "Payable Days", "Late", "Absent", "Gross Salary", "Earned Salary", "Additions", "Attendance Deduction", "Other Deductions", "Net Payable"]}
      loading={loading}
    >
      {sheet.lines.map((l, i) => (
        <tr key={l.employeeId} className={TABLE.row}>
          <td className={`${num} text-ink-faint`}>{i + 1}</td>
          <td className={`${td} tabular-nums`}>{l.employeeCode}</td>
          <td className={`${td} whitespace-nowrap`}>{l.employeeName}</td>
          <td className={td}>{l.designation ?? "—"}</td>
          <td className={num}>{l.monthDays}</td>
          <td className={num}>{l.payableDays}</td>
          <td className={num}>{l.lateCount}</td>
          <td className={num}>{l.absentDays}</td>
          <td className={num}>{formatMoney(l.grossSalary)}</td>
          <td className={num}>{formatMoney(l.earnedSalary)}</td>
          <td className={num}>{formatMoney(l.additions)}</td>
          <td className={num} title={l.deductionDays ? `${l.deductionDays} day(s): absences, unpaid leave and late punishment` : undefined}>
            {formatMoney(l.attendanceDeduction)}
          </td>
          <td className={num}>{formatMoney(l.otherDeduction)}</td>
          <td className={`${num} font-semibold`}>{formatMoney(l.netAmount)}</td>
        </tr>
      ))}
      <tr className="border-t-2 border-grid-head-rule bg-grid-head font-semibold">
        <td className={td} colSpan={6}>
          Total ({sheet.lines.length} employees)
        </td>
        <td className={num}>{t.lateCount}</td>
        <td className={num} />
        <td className={num}>{formatMoney(t.grossSalary)}</td>
        <td className={num}>{formatMoney(t.earnedSalary)}</td>
        <td className={num}>{formatMoney(t.additions)}</td>
        <td className={num}>{formatMoney(t.attendanceDeduction)}</td>
        <td className={num}>{formatMoney(t.deductions - t.attendanceDeduction)}</td>
        <td className={num}>{formatMoney(t.netAmount)}</td>
      </tr>
    </Grid>
  );
}
