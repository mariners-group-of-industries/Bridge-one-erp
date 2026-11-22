"use client";

import { CalendarSearch, Eye, PencilLine } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Pagination } from "@/components/ui/pagination";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useResource } from "@/hooks/use-resource";
import { cn } from "@/lib/cn";
import { CONTROL_CLASS, EmptyBlock, Panel, TABLE } from "@/features/configuration/entity-master-data/employee/components/kit";
import { essApi } from "../api";
import { essPaths } from "../navigation";
import type { EssDayStatus } from "../types";
import { DayStatusBadge, EssPage, MonthPicker, StatTile, fmtClock, fmtDate, fmtMinutes, fmtMoney, localToday, monthTitle, usePaged } from "./ess-ui";

const STATUSES: (EssDayStatus | "ALL")[] = ["ALL", "Present", "Late", "Absent", "Leave", "Weekly Off", "Holiday", "Pending", "No Schedule"];
type Query = { mode: "month"; month: string; status: string } | { mode: "range"; from: string; to: string; status: string };

export function AttendanceView() {
  return <EssPage title="My Attendance" subtitle="Your attendance as recorded by HR's attendance system. Records are read-only; ask for a correction if something is wrong.">{() => <Attendance />}</EssPage>;
}

function Attendance() {
  // month "" = the payroll period that contains today (the server works it out from the Payroll Rule).
  const [draft, setDraft] = useState<Query>({ mode: "month", month: "", status: "ALL" });
  const [query, setQuery] = useState<Query>(draft);
  const [rangeError, setRangeError] = useState("");
  const key = JSON.stringify(query);
  const data = useResource(`ess-attendance:${key}`, () => essApi.attendance(query.mode === "month" ? { month: query.month || undefined, status: query.status } : { from: query.from, to: query.to, status: query.status }));
  // The picker shows the payroll month the server chose until one is picked.
  const pickedMonth = draft.mode === "month" ? draft.month || (query.mode === "month" && !query.month ? data.data?.month : undefined) || localToday().slice(0, 7) : "";
  const paged = usePaged(data.data?.days ?? [], 15);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (draft.mode === "range") {
      if (!draft.from || !draft.to) return setRangeError("Choose both dates.");
      if (draft.to < draft.from) return setRangeError("To Date cannot be before From Date.");
    }
    setRangeError("");
    paged.setPage(1);
    setQuery(draft);
  }

  const s = data.data?.summary;
  return (
    <>
      <Panel>
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3" aria-label="Attendance filters">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink-muted" id="ess-att-mode">
              Period
            </span>
            <div role="group" aria-labelledby="ess-att-mode" className="flex h-8 overflow-hidden rounded border border-line-strong">
              {(["month", "range"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={draft.mode === mode}
                  onClick={() => setDraft(mode === "month" ? { mode, month: "", status: draft.status } : { mode, from: data.data && data.data.from <= localToday() ? data.data.from : `${localToday().slice(0, 7)}-01`, to: localToday(), status: draft.status })}
                  className={cn("px-3 text-xs font-semibold focus-visible:outline-2", draft.mode === mode ? "bg-accent-soft text-accent-strong dark:text-accent" : "bg-surface text-ink-muted hover:bg-control")}
                >
                  {mode === "month" ? "Payroll Month" : "Date Range"}
                </button>
              ))}
            </div>
          </div>
          {draft.mode === "month" ? (
            <MonthPicker idPrefix="ess-att" value={pickedMonth} onChange={(month) => setDraft({ ...draft, month })} />
          ) : (
            <>
              <div className="flex w-36 flex-col gap-1">
                <label htmlFor="ess-att-from" className="text-xs font-medium text-ink-muted">
                  From Date
                </label>
                <DateInput className={CONTROL_CLASS} id="ess-att-from" value={draft.from} onChange={(from) => setDraft({ ...draft, from })} />
              </div>
              <div className="flex w-36 flex-col gap-1">
                <label htmlFor="ess-att-to" className="text-xs font-medium text-ink-muted">
                  To Date
                </label>
                <DateInput className={CONTROL_CLASS} id="ess-att-to" value={draft.to} onChange={(to) => setDraft({ ...draft, to })} />
              </div>
            </>
          )}
          <div className="flex flex-col gap-1">
            <label htmlFor="ess-att-status" className="text-xs font-medium text-ink-muted">
              Status
            </label>
            <select id="ess-att-status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className="h-8 rounded border border-line-strong bg-surface px-2 text-[12px] text-ink focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none">
              {STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st === "ALL" ? "All statuses" : st}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="primary" loading={data.loading}>
            <CalendarSearch aria-hidden="true" />
            View
          </Button>
          {data.data && (
            <p className="w-full text-xs text-ink-muted tabular-nums">
              Showing {fmtDate(data.data.from)} – {fmtDate(data.data.to)}
              {query.mode === "month" ? " · payroll period (21st – 20th unless the Payroll Rule says otherwise)" : ""}
            </p>
          )}
          {rangeError && (
            <p role="alert" className="w-full text-xs text-danger">
              {rangeError}
            </p>
          )}
        </form>
      </Panel>

      {s && (
        <section aria-label="Attendance summary" className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
          <StatTile label="Working Days" value={s.workingDays} note="Assigned" />
          <StatTile label="Present" value={s.present} tone="success" />
          <StatTile label="Late" value={s.late} tone="warning" />
          <StatTile label="Absent" value={s.absent} tone="danger" />
          <StatTile label="Leave" value={s.leave} tone="primary" />
          <StatTile label="Weekly Off" value={s.weeklyOff} />
          <StatTile label="Holidays" value={s.holidays} />
          <StatTile
            label="Deduction Days"
            value={s.lateDeductionDays + (s.absentDeductionDays ?? 0)}
            tone={s.lateDeductionDays + (s.absentDeductionDays ?? 0) > 0 ? "danger" : "neutral"}
            note={data.data?.payroll ? `Payslip: BDT ${fmtMoney(data.data.payroll.attendanceDeduction)}` : "Estimate under current policy"}
          />
        </section>
      )}

      <Panel
        title={data.data ? (query.mode === "month" ? monthTitle(data.data.month) : `${fmtDate(data.data.from)} – ${fmtDate(data.data.to)}`) : "Attendance"}
        description={s?.lateRule ? `Late rule: every ${s.lateRule.latesAllowed} lates deduct ${s.lateRule.deductionDays} day(s) from ${s.lateRule.deductFrom}.` : undefined}
        flush
      >
        {data.error ? (
          <ErrorState message={data.error.message} onRetry={data.reload} />
        ) : !data.data ? (
          <LoadingState label="Loading attendance…" />
        ) : data.data.days.length === 0 ? (
          <div className="p-4">
            <EmptyBlock icon={<CalendarSearch />} title="No attendance for this period">
              There are no attendance records{query.status !== "ALL" ? ` with status ${query.status}` : ""} for the selected period. Recently joined? Records start from your joining date.
            </EmptyBlock>
          </div>
        ) : (
          <>
            <div className={cn(TABLE.wrap, "rounded-none border-x-0 border-t-0")}>
              <table className={TABLE.table}>
                <thead className={TABLE.head}>
                  <tr>
                    {["SL", "Date", "Day", "Shift", "Scheduled In", "Scheduled Out", "Actual In", "Actual Out", "Late", "Worked", "Status", "Deduction", "Action"].map((h) => (
                      <th key={h} scope="col" className={TABLE.th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.rows.map((d, i) => (
                    <tr key={d.date} className={TABLE.row}>
                      <td className={cn(TABLE.td, "text-ink-muted tabular-nums")}>{(paged.page - 1) * paged.pageSize + i + 1}</td>
                      <td className={cn(TABLE.td, "whitespace-nowrap tabular-nums")}>{fmtDate(d.date)}</td>
                      <td className={TABLE.td}>{d.day}</td>
                      <td className={cn(TABLE.td, "max-w-40 truncate")} title={d.holidayTitle ?? d.shift ?? undefined}>
                        {d.holidayTitle ?? d.shift ?? <span className="text-ink-faint">Not assigned</span>}
                      </td>
                      <td className={cn(TABLE.td, "whitespace-nowrap tabular-nums")}>{fmtClock(d.scheduledIn)}</td>
                      <td className={cn(TABLE.td, "whitespace-nowrap tabular-nums")}>{fmtClock(d.scheduledOut)}</td>
                      <td className={cn(TABLE.td, "whitespace-nowrap tabular-nums")}>{d.actualIn ?? "—"}</td>
                      <td className={cn(TABLE.td, "whitespace-nowrap tabular-nums")}>{d.actualOut ?? "—"}</td>
                      <td className={cn(TABLE.td, "whitespace-nowrap tabular-nums", !!d.lateMinutes && "text-warning")}>{d.lateMinutes ? fmtMinutes(d.lateMinutes) : "—"}</td>
                      <td className={cn(TABLE.td, "whitespace-nowrap tabular-nums")}>{fmtMinutes(d.workedMinutes)}</td>
                      <td className={cn(TABLE.td, "whitespace-nowrap")}>
                        <DayStatusBadge status={d.status} provisional={d.provisional} />
                        {d.leaveType && <span className="ml-1 text-[11px] text-ink-muted">{d.leaveType}</span>}
                        {d.correction === "Pending" && <span className="ml-1 text-[11px] text-warning">Correction pending</span>}
                      </td>
                      <td className={cn(TABLE.td, "whitespace-nowrap text-[11px]", d.deduction?.includes("day") ? "text-danger" : "text-ink-muted")}>{d.deduction ?? "—"}</td>
                      <td className={cn(TABLE.td, "whitespace-nowrap")}>
                        <div className="flex gap-1">
                          <Link href={`${essPaths.dailyAttendance}?date=${d.date}`} className={buttonClasses("ghost", "icon")} aria-label={`View ${fmtDate(d.date)} in detail`} title="View details">
                            <Eye aria-hidden="true" />
                          </Link>
                          <Link href={`${essPaths.corrections}?date=${d.date}`} className={buttonClasses("ghost", "icon")} aria-label={`Request a correction for ${fmtDate(d.date)}`} title="Request correction">
                            <PencilLine aria-hidden="true" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination className="px-4 py-3" page={paged.page} pageSize={paged.pageSize} totalRecords={paged.totalRecords} totalPages={paged.totalPages} pageSizes={[15, 31, 62]} onPageChange={paged.setPage} onPageSizeChange={paged.setPageSize} noun="days" />
          </>
        )}
      </Panel>
    </>
  );
}
