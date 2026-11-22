"use client";

import { ChevronLeft, ChevronRight, Fingerprint, PencilLine } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useResource } from "@/hooks/use-resource";
import { cn } from "@/lib/cn";
import { CONTROL_CLASS, EmptyBlock, Panel, TABLE } from "@/features/configuration/entity-master-data/employee/components/kit";
import { essApi } from "../api";
import { essPaths } from "../navigation";
import type { EssEmployee } from "../types";
import { DayStatusBadge, EssPage, RequestStatusBadge, fmtClock, fmtDate, fmtDateTime, fmtMinutes, localToday } from "./ess-ui";

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export function DailyAttendanceView() {
  return <EssPage title="Daily Attendance">{(employee) => <Daily employee={employee} />}</EssPage>;
}

function Daily({ employee }: { employee: EssEmployee }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = params.get("date");
  const date = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : localToday();
  const go = (next: string) => router.replace(`${pathname}?date=${next}`, { scroll: false });
  const data = useResource(`ess-day:${date}`, () => essApi.day(date));

  return (
    <>
      <Panel>
        <div className="flex flex-wrap items-end gap-2">
          <Button size="icon" aria-label="Previous day" onClick={() => go(addDays(date, -1))} className="size-8">
            <ChevronLeft aria-hidden="true" />
          </Button>
          <div className="flex w-40 flex-col gap-1">
            <label htmlFor="ess-day-date" className="text-xs font-medium text-ink-muted">
              Attendance Date
            </label>
            <DateInput className={CONTROL_CLASS} id="ess-day-date" value={date} onChange={(next) => next && go(next)} />
          </div>
          <Button size="icon" aria-label="Next day" onClick={() => go(addDays(date, 1))} disabled={date >= localToday()} className="size-8">
            <ChevronRight aria-hidden="true" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => go(localToday())} disabled={date === localToday()} className="h-8">
            Today
          </Button>
          <p className="ml-auto text-xs text-ink-muted">
            <span className="font-semibold text-ink">{employee.name}</span> · <span className="font-mono">{employee.code}</span>
          </p>
        </div>
      </Panel>

      {data.error ? (
        <Panel>
          <ErrorState message={data.error.message} onRetry={data.reload} />
        </Panel>
      ) : !data.data ? (
        <Panel>
          <LoadingState label="Loading the day…" />
        </Panel>
      ) : (
        <>
          <Panel
            title={`${fmtDate(data.data.day.date)} · ${data.data.day.day}`}
            description={data.data.processing}
            actions={
              <>
                <DayStatusBadge status={data.data.day.status} provisional={data.data.day.provisional} />
                {data.data.canRequestCorrection && (
                  <Link href={`${essPaths.corrections}?date=${date}`} className={buttonClasses("secondary", "sm")}>
                    <PencilLine aria-hidden="true" />
                    Request Correction
                  </Link>
                )}
              </>
            }
          >
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
              <Item label="Assigned Calendar" value={data.data.calendar ? `${data.data.calendar.name} (${data.data.calendar.code})` : (data.data.day.holidayTitle ?? data.data.day.shift ?? "Not assigned")} />
              <Item label="Scheduled Start" value={fmtClock(data.data.calendar?.start)} />
              <Item label="Scheduled End" value={fmtClock(data.data.calendar?.end)} />
              <Item label="Late After" value={fmtClock(data.data.calendar?.graceTime)} />
              <Item label="Absent After" value={fmtClock(data.data.calendar?.lastStartTime)} />
              <Item label="First Check-in" value={data.data.day.actualIn ?? "—"} />
              <Item label="Last Check-out" value={data.data.day.actualOut ?? (data.data.day.actualIn && data.data.day.provisional ? "Not yet" : "—")} />
              <Item label="Working Hours" value={fmtMinutes(data.data.day.workedMinutes)} />
              <Item label="Late Arrival" value={data.data.day.lateMinutes ? fmtMinutes(data.data.day.lateMinutes) : "—"} tone={data.data.day.lateMinutes ? "warning" : undefined} />
              <Item label="Early Departure" value={data.data.day.earlyLeaveMinutes ? fmtMinutes(data.data.day.earlyLeaveMinutes) : "—"} tone={data.data.day.earlyLeaveMinutes ? "warning" : undefined} />
              <Item label="Leave" value={data.data.day.leaveType ?? "—"} />
              <Item label="Deduction" value={data.data.day.deduction ?? "—"} />
              <Item label="Remarks" value={data.data.day.remarks ?? "—"} wide />
            </dl>
            {data.data.day.status === "No Schedule" && <p className="mt-4 rounded border border-line bg-canvas px-3 py-2 text-xs text-ink-muted">Attendance is pending processing.</p>}
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Device Punches" description="Every punch your attendance device recorded on this day." flush>
              {data.data.punches.length === 0 ? (
                <div className="p-4">
                  <EmptyBlock icon={<Fingerprint />} title="No punches recorded">
                    {data.data.day.provisional ? "Punches can take a few minutes to arrive from the device." : "If you were at work, request a correction."}
                  </EmptyBlock>
                </div>
              ) : (
                <div className={cn(TABLE.wrap, "rounded-none border-x-0 border-t-0 border-b-0")}>
                  <table className={TABLE.table}>
                    <thead className={TABLE.head}>
                      <tr>
                        <th scope="col" className={TABLE.th}>#</th>
                        <th scope="col" className={TABLE.th}>Time</th>
                        <th scope="col" className={TABLE.th}>Device</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.data.punches.map((p, i) => (
                        <tr key={`${p.time}-${i}`} className={TABLE.row}>
                          <td className={cn(TABLE.td, "text-ink-muted")}>{i + 1}</td>
                          <td className={cn(TABLE.td, "tabular-nums")}>{p.time}</td>
                          <td className={TABLE.td}>{p.device}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel title="Correction Requests" description="Your requests for this day." flush>
              {data.data.requests.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-ink-faint">No correction requested for this day.</p>
              ) : (
                <ul>
                  {data.data.requests.map((r) => (
                    <li key={r.id} className="flex flex-col gap-1 border-b border-line px-5 py-3 last:border-b-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-medium text-ink">
                          {r.originalStatus ?? "No record"} → {r.requestedStatus}
                        </span>
                        <RequestStatusBadge status={r.status} />
                      </div>
                      {r.reason && <p className="text-xs text-ink-muted">{r.reason}</p>}
                      <p className="text-[11px] text-ink-faint">Requested {fmtDateTime(r.requestedAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </>
  );
}

function Item({ label, value, tone, wide }: { label: string; value: ReactNode; tone?: "warning"; wide?: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", wide && "col-span-2 sm:col-span-3 lg:col-span-5")}>
      <dt className="text-[11px] font-medium text-ink-faint">{label}</dt>
      <dd className={cn("text-[13px] font-medium break-words text-ink tabular-nums", tone === "warning" && "text-warning")}>{value}</dd>
    </div>
  );
}
