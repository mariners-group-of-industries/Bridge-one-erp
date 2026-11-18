"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useResource } from "@/hooks/use-resource";
import { cn } from "@/lib/cn";
import { Panel } from "@/features/configuration/entity-master-data/employee/components/kit";
import { essApi } from "../api";
import { essPaths } from "../navigation";
import type { EssCalendarDay } from "../types";
import { DAY_STATUS, DayStatusBadge, EssPage, fmtClock, fmtDate, localToday, monthTitle, shiftMonth } from "./ess-ui";

const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const LEGEND: { label: string; dot: string }[] = [
  { label: "Present", dot: DAY_STATUS.Present.dot },
  { label: "Late", dot: DAY_STATUS.Late.dot },
  { label: "Absent", dot: DAY_STATUS.Absent.dot },
  { label: "Approved Leave", dot: DAY_STATUS.Leave.dot },
  { label: "Weekly Off", dot: DAY_STATUS["Weekly Off"].dot },
  { label: "Holiday", dot: DAY_STATUS.Holiday.dot },
  { label: "Pending", dot: DAY_STATUS.Pending.dot },
];

export function CalendarView() {
  return <EssPage title="My Calendar" subtitle="Your assigned calendar from HR. Ask HR to change a shift or off day.">{() => <Calendar />}</EssPage>;
}

function dotOf(d: EssCalendarDay): string | null {
  if (d.status && d.status !== "Upcoming" && d.status !== "No Schedule") return DAY_STATUS[d.status].dot;
  if (d.leave?.status === "Approved") return DAY_STATUS.Leave.dot;
  if (d.kind === "holiday") return DAY_STATUS.Holiday.dot;
  if (d.kind === "off") return DAY_STATUS["Weekly Off"].dot;
  return null;
}

function Calendar() {
  const today = localToday();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState<string>(today);
  const data = useResource(`ess-calendar:${month}`, () => essApi.calendar(month));
  const days = data.data?.days ?? [];
  const lead = days.length ? new Date(`${days[0].date}T00:00:00Z`).getUTCDay() : 0;
  const chosen = days.find((d) => d.date === selected) ?? null;

  const move = (by: number) => {
    const next = shiftMonth(month, by);
    setMonth(next);
    setSelected(next === today.slice(0, 7) ? today : `${next}-01`);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel
        className="lg:col-span-2"
        title={monthTitle(month)}
        actions={
          <div className="flex items-center gap-1">
            <Button size="icon" aria-label="Previous month" onClick={() => move(-1)}>
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setMonth(today.slice(0, 7)); setSelected(today); }} disabled={month === today.slice(0, 7)}>
              This month
            </Button>
            <Button size="icon" aria-label="Next month" onClick={() => move(1)}>
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        }
      >
        {data.error ? (
          <ErrorState message={data.error.message} onRetry={data.reload} />
        ) : !data.data ? (
          <LoadingState label="Loading calendar…" />
        ) : (
          <>
            <div aria-label={`Calendar for ${monthTitle(month)}`} role="group" className="grid grid-cols-7 gap-1">
              {WEEK.map((w) => (
                <div key={w} aria-hidden="true" className="pb-1 text-center text-[11px] font-semibold tracking-wide text-ink-faint uppercase">
                  {w}
                </div>
              ))}
              {Array.from({ length: lead }, (_, i) => (
                <div key={`lead-${i}`} aria-hidden="true" />
              ))}
              {days.map((d) => {
                const dot = dotOf(d);
                const isToday = d.date === today;
                const isSelected = d.date === selected;
                const label = [fmtDate(d.date), d.holidayTitle ?? d.shift ?? "No schedule", d.leave ? `${d.leave.type} (${d.leave.status})` : null, d.status && d.status !== "Upcoming" ? d.status : null].filter(Boolean).join(", ");
                return (
                  <button
                    key={d.date}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={label}
                    onClick={() => setSelected(d.date)}
                    className={cn(
                      "flex min-h-14 flex-col items-start gap-0.5 rounded border p-1.5 text-left transition-colors focus-visible:outline-2 sm:min-h-20",
                      isSelected ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong hover:bg-control/50",
                      (d.kind === "off" || d.kind === "holiday") && !isSelected && "bg-canvas",
                    )}
                  >
                    <span className={cn("flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums", isToday ? "bg-accent-strong text-white dark:bg-accent" : "text-ink")}>{Number(d.date.slice(8))}</span>
                    <span className="hidden w-full truncate text-[10.5px] text-ink-muted sm:block">{d.holidayTitle ?? (d.kind === "work" ? d.shift?.replace(/\s*\(.*\)$/, "") : d.kind === "off" ? "Off" : "")}</span>
                    {d.leave && <span className={cn("hidden w-full truncate text-[10.5px] sm:block", d.leave.status === "Approved" ? "text-accent-strong dark:text-accent" : "text-warning")}>{d.leave.type}</span>}
                    {dot && <span aria-hidden="true" className={cn("mt-auto size-2 rounded-full", dot)} />}
                  </button>
                );
              })}
            </div>
            <ul aria-label="Legend" className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line pt-3">
              {LEGEND.map((l) => (
                <li key={l.label} className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <span aria-hidden="true" className={cn("size-2 rounded-full", l.dot)} />
                  {l.label}
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      <div className="flex flex-col gap-4">
        <Panel title={chosen ? `${fmtDate(chosen.date)} · ${chosen.day}` : "Day details"}>
          {!chosen ? (
            <p className="text-sm text-ink-faint">Select a day to see its schedule.</p>
          ) : (
            <dl className="flex flex-col gap-3 text-[13px]">
              <Row label="Schedule" value={chosen.holidayTitle ? `Holiday: ${chosen.holidayTitle}` : chosen.kind === "off" ? "Weekly off" : (chosen.shift ?? "No calendar assigned")} />
              {chosen.start && <Row label="Shift time" value={`${fmtClock(chosen.start)} – ${fmtClock(chosen.end)}`} />}
              {chosen.leave && <Row label="Leave" value={<span>{chosen.leave.type} <Badge variant={chosen.leave.status === "Approved" ? "primary" : "warning"}>{chosen.leave.status}</Badge></span>} />}
              <Row label="Attendance" value={chosen.status && chosen.status !== "Upcoming" ? <DayStatusBadge status={chosen.status} provisional={chosen.date === today} /> : chosen.date > today ? "Upcoming" : "—"} />
              {chosen.date <= today && (
                <Link href={`${essPaths.dailyAttendance}?date=${chosen.date}`} className={buttonClasses("secondary", "sm", "self-start")}>
                  Open daily attendance
                </Link>
              )}
            </dl>
          )}
        </Panel>
        <Panel title="Holidays this month">
          {!data.data?.holidays.length ? (
            <p className="text-sm text-ink-faint">No holidays this month.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-[13px]">
              {data.data.holidays.map((h) => (
                <li key={h.date} className="flex justify-between gap-2">
                  <span className="text-ink">{h.title}</span>
                  <span className="shrink-0 text-ink-muted tabular-nums">{fmtDate(h.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-medium text-ink-faint">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
