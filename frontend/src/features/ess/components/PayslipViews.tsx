"use client";

import { ArrowLeft, Eye, Printer, ReceiptText } from "lucide-react";
import Link from "next/link";
import { Button, buttonClasses } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useResource } from "@/hooks/use-resource";
import { cn } from "@/lib/cn";
import { EmptyBlock, Panel, ReadValue, TABLE } from "@/features/configuration/entity-master-data/employee/components/kit";
import { essApi } from "../api";
import { essPaths } from "../navigation";
import { EssPage, fmtDate, fmtMoney, monthTitle } from "./ess-ui";

export function PayslipsView() {
  return <EssPage title="My Payslips" subtitle="Payslips appear here once HR approves the payroll and publishes it.">{() => <Payslips />}</EssPage>;
}

function Payslips() {
  const data = useResource("ess-payslips", essApi.payslips);
  return (
    <Panel title="Payslip History" flush>
      {data.error ? (
        <ErrorState message={data.error.message} onRetry={data.reload} />
      ) : !data.data ? (
        <LoadingState label="Loading payslips…" />
      ) : data.data.length === 0 ? (
        <div className="p-4">
          <EmptyBlock icon={<ReceiptText />} title="No payslips published yet">
            A payslip appears after HR approves the month&apos;s payroll and publishes it. Payrolls still under processing are not shown.
          </EmptyBlock>
        </div>
      ) : (
        <div className={cn(TABLE.wrap, "rounded-none border-0")}>
          <table className={TABLE.table}>
            <thead className={TABLE.head}>
              <tr>
                {["Month", "Payroll Date", "Type", "Gross Salary", "Allowances", "Deductions", "Net Salary", "Status", "Action"].map((h) => (
                  <th key={h} scope="col" className={cn(TABLE.th, ["Gross Salary", "Allowances", "Deductions", "Net Salary"].includes(h) && "text-right")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.data.map((p) => (
                <tr key={p.id} className={TABLE.row}>
                  <td className={cn(TABLE.td, "font-medium whitespace-nowrap")}>{monthTitle(p.month)}</td>
                  <td className={cn(TABLE.td, "whitespace-nowrap tabular-nums")}>{fmtDate(p.payrollDate)}</td>
                  <td className={TABLE.td}>{p.salaryType}</td>
                  <td className={cn(TABLE.td, "text-right tabular-nums")}>{fmtMoney(p.grossSalary)}</td>
                  <td className={cn(TABLE.td, "text-right tabular-nums")}>{fmtMoney(p.allowances)}</td>
                  <td className={cn(TABLE.td, "text-right text-danger tabular-nums")}>{fmtMoney(p.deductions)}</td>
                  <td className={cn(TABLE.td, "text-right font-semibold tabular-nums")}>{fmtMoney(p.netPayable)}</td>
                  <td className={TABLE.td}>
                    <span className="inline-flex items-center rounded border border-success/30 bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-success">Published</span>
                  </td>
                  <td className={TABLE.td}>
                    <Link href={essPaths.payslip(p.id)} className={buttonClasses("ghost", "icon")} aria-label={`Open payslip for ${monthTitle(p.month)}`} title="View payslip">
                      <Eye aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

export function PayslipView({ id }: { id: string }) {
  return (
    <EssPage
      title="Payslip"
      actions={
        <>
          <Link href={essPaths.payslips} className={buttonClasses("secondary", "md")}>
            <ArrowLeft aria-hidden="true" />
            Back
          </Link>
          <Button onClick={() => window.print()}>
            <Printer aria-hidden="true" />
            Print
          </Button>
        </>
      }
    >
      {() => <Payslip id={id} />}
    </EssPage>
  );
}

function Lines({ title, rows, total, totalLabel, negative }: { title: string; rows: { label: string; amount: number }[]; total: number; totalLabel: string; negative?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col">
      <h3 className="border-b border-line pb-1.5 text-[11px] font-bold tracking-wide text-ink-muted uppercase">{title}</h3>
      <dl className="flex flex-col">
        {rows.length === 0 ? (
          <p className="py-2 text-[13px] text-ink-faint">None</p>
        ) : (
          rows.map((r) => (
            <div key={r.label} className="flex justify-between gap-3 border-b border-dashed border-line py-1.5 text-[13px]">
              <dt className="text-ink-muted">{r.label}</dt>
              <dd className={cn("text-ink tabular-nums", negative && "text-danger")}>{fmtMoney(r.amount)}</dd>
            </div>
          ))
        )}
        <div className="flex justify-between gap-3 pt-2 text-[13px] font-semibold">
          <dt className="text-ink">{totalLabel}</dt>
          <dd className={cn("tabular-nums", negative ? "text-danger" : "text-ink")}>{fmtMoney(total)}</dd>
        </div>
      </dl>
    </div>
  );
}

function Payslip({ id }: { id: string }) {
  const data = useResource(`ess-payslip:${id}`, () => essApi.payslip(id));
  if (data.error) return <Panel><ErrorState message={data.error.message} onRetry={data.reload} /></Panel>;
  if (!data.data) return <Panel><LoadingState label="Loading payslip…" /></Panel>;
  const p = data.data;
  const att = p.attendance as Record<string, unknown>;
  const count = (key: string) => (typeof att[key] === "number" ? (att[key] as number) : null);
  return (
    <article className="flex flex-col gap-4 print:gap-2">
      <Panel title={`Payslip · ${monthTitle(p.month)}`} description={`${p.reference} · ${p.salaryType} · period ${fmtDate(p.period.from)} – ${fmtDate(p.period.to)}`}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <ReadValue label="Employee" value={p.employee.name} />
          <ReadValue label="Employee Code" value={<span className="font-mono">{p.employee.code}</span>} />
          <ReadValue label="Designation" value={p.employee.designation} />
          <ReadValue label="Department" value={p.employee.department} />
          <ReadValue label="Office" value={p.employee.office} />
          <ReadValue label="Payroll Date" value={fmtDate(p.payrollDate)} />
          <ReadValue label="Pay Method" value={p.payMethod} />
          <ReadValue label="Gross Salary" value={fmtMoney(p.grossSalary)} />
          {count("workingDays") !== null && <ReadValue label="Working Days" value={count("workingDays")} />}
          {count("presentDays") !== null && <ReadValue label="Present Days" value={count("presentDays")} />}
          {count("absentDays") !== null && <ReadValue label="Absent Days" value={count("absentDays")} />}
          {count("lateCount") !== null && <ReadValue label="Lates" value={count("lateCount")} />}
          {count("paidLeaveDays") !== null && <ReadValue label="Paid Leave Days" value={count("paidLeaveDays")} />}
        </div>
      </Panel>
      <Panel>
        <div className="grid gap-6 md:grid-cols-2">
          <Lines title="Earnings" rows={p.earnings} total={p.earnedGross + p.additions} totalLabel="Gross Earned" />
          <Lines title="Deductions" rows={p.deductionLines} total={p.deductions} totalLabel="Total Deductions" negative />
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 rounded border border-accent-line bg-accent-soft px-4 py-3">
          <span className="text-sm font-semibold text-ink">Net Payable</span>
          <span className="text-2xl font-bold text-ink tabular-nums">BDT {fmtMoney(p.netPayable)}</span>
        </div>
        <p className="mt-3 text-[11px] text-ink-faint">Earned gross includes salary prorated to the days employed in the period plus allowances and additions. Figures are as approved in payroll {p.reference}.</p>
      </Panel>
    </article>
  );
}
