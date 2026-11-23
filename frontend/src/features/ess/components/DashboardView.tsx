"use client";

import { ArrowRight, CalendarDays, CalendarPlus, ClipboardEdit, Clock, FileText, Megaphone, ReceiptText, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useResource } from "@/hooks/use-resource";
import { cn } from "@/lib/cn";
import { Avatar, EmptyBlock, Panel } from "@/features/configuration/entity-master-data/employee/components/kit";
import { essApi } from "../api";
import { essPaths } from "../navigation";
import type { EssDashboard, EssEmployee } from "../types";
import { DayStatusBadge, EssPage, StatTile, fmtClock, fmtDate, fmtDateTime, fmtMinutes, fmtMoney, monthTitle } from "./ess-ui";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

export function DashboardView() {
  return <EssPage title="My Dashboard">{(employee) => <Dashboard employee={employee} />}</EssPage>;
}

function Dashboard({ employee }: { employee: EssEmployee }) {
  const data = useResource("ess-dashboard", essApi.dashboard, { refreshOnFocus: true });
  if (data.error) return <Panel><ErrorState message={data.error.message} onRetry={data.reload} /></Panel>;
  if (!data.data) return <Panel><LoadingState label="Loading your dashboard…" /></Panel>;
  const d = data.data;
  const s = d.month.summary;
  return (
    <>
      <Header employee={employee} />

      <section aria-labelledby="ess-month-heading" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="ess-month-heading" className="text-sm font-semibold text-ink">
            Attendance period {fmtDate(d.month.from)} – {fmtDate(d.month.to)} <span className="font-normal text-ink-muted">· so far</span>
          </h2>
          <Link href={essPaths.attendance} className="inline-flex min-h-6 items-center gap-1 rounded text-xs font-medium text-accent-strong hover:underline focus-visible:outline-2 dark:text-accent">
            View attendance <ArrowRight aria-hidden="true" className="size-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Present" value={s.present} tone="success" />
          <StatTile label="Late" value={s.late} tone="warning" note={s.lateRule ? `${s.lateRule.latesAllowed} lates = ${s.lateRule.deductionDays} day(s)` : undefined} />
          <StatTile label="Absent" value={s.absent} tone="danger" />
          <StatTile label="Leave" value={s.leave} tone="primary" />
          <StatTile label="Working Days" value={s.workingDays} note="Assigned this period" />
          <StatTile label="Attendance" value={s.attendanceRate === null ? "—" : `${s.attendanceRate}%`} note={s.pending ? `${s.pending} day pending` : "Of scheduled days so far"} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <TodayCard today={d.today} />
          <LeaveSummary leave={d.leave} />
          <Activities activities={d.activities} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <QuickActions canApply={employee.canApply} />
          <Upcoming items={d.upcoming} />
          {d.latestPayslip && (
            <Panel title="Latest Payslip" actions={<Link href={essPaths.payslip(d.latestPayslip.id)} className="inline-flex min-h-6 min-w-6 items-center justify-center rounded px-1.5 text-xs font-medium text-accent-strong hover:underline focus-visible:outline-2 dark:text-accent">Open</Link>}>
              <p className="text-xs text-ink-muted">{monthTitle(d.latestPayslip.month)} · {d.latestPayslip.salaryType}</p>
              <p className="mt-1 text-xl font-bold text-ink tabular-nums">BDT {fmtMoney(d.latestPayslip.netPayable)}</p>
              <p className="text-[11px] text-ink-faint">Net payable · paid {fmtDate(d.latestPayslip.payrollDate)}</p>
            </Panel>
          )}
          <Notices notices={d.notices} />
        </div>
      </div>
    </>
  );
}

function Header({ employee }: { employee: EssEmployee }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const meta = [employee.designation, employee.department, employee.officeName].filter(Boolean).join(" · ");
  return (
    <section className="flex flex-wrap items-center gap-4 rounded border border-line bg-surface p-4 shadow-xs">
      {employee.hasPhoto && !photoFailed ? (
        <Image src={essApi.photoUrl} alt="" width={56} height={56} unoptimized onError={() => setPhotoFailed(true)} className="size-14 shrink-0 rounded-full border border-line object-cover" />
      ) : (
        <Avatar name={employee.name} size="lg" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h2 className="text-lg font-bold tracking-tight text-ink sm:text-xl">
          {greeting()}, {employee.name}
        </h2>
        <p className="truncate text-[13px] text-ink-muted">{meta || "Employee"}</p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
          <span className="font-mono font-semibold text-ink-muted">{employee.code}</span>
          <span>Joined {fmtDate(employee.joiningDate)}</span>
          {!employee.canApply && <Badge variant="danger">Employment inactive</Badge>}
        </p>
      </div>
      <p className="text-right text-xs text-ink-muted">
        <span className="block text-sm font-semibold text-ink">{new Date().toLocaleDateString("en-GB", { weekday: "long" })}</span>
        {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}
      </p>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[11px] font-medium text-ink-faint">{label}</dt>
      <dd className="truncate text-[13px] font-medium text-ink tabular-nums">{value}</dd>
    </div>
  );
}

function TodayCard({ today }: { today: EssDashboard["today"] }) {
  return (
    <Panel
      title="Today's Attendance"
      description={today.provisional ? "Updates as punches arrive." : undefined}
      actions={<DayStatusBadge status={today.status} provisional={today.provisional} />}
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <Fact label="Date" value={fmtDate(today.date)} />
        <Fact label="Shift" value={today.shift ?? "Not assigned"} />
        <Fact label="Scheduled" value={today.scheduledIn ? `${fmtClock(today.scheduledIn)} – ${fmtClock(today.scheduledOut)}` : "—"} />
        <Fact label="Status" value={today.status === "Pending" ? "Not punched in yet" : today.status} />
        <Fact label="First Check-in" value={today.actualIn ?? "—"} />
        <Fact label="Last Check-out" value={today.actualOut ?? (today.actualIn ? "Not yet" : "—")} />
        <Fact label="Late By" value={today.lateMinutes ? fmtMinutes(today.lateMinutes) : "—"} />
        <Fact label="Worked" value={fmtMinutes(today.workedMinutes)} />
      </dl>
      {today.correction === "Pending" && <p className="mt-3 text-xs text-warning">A correction for today is waiting for HR approval.</p>}
      <Link href={`${essPaths.dailyAttendance}?date=${today.date}`} className="mt-3 inline-flex min-h-6 items-center gap-1 rounded text-xs font-medium text-accent-strong hover:underline focus-visible:outline-2 dark:text-accent">
        View today in detail <ArrowRight aria-hidden="true" className="size-3" />
      </Link>
    </Panel>
  );
}

function LeaveSummary({ leave }: { leave: EssDashboard["leave"] }) {
  const tracked = leave.balances.filter((b) => b.quota !== null);
  return (
    <Panel
      title="Leave Summary"
      description={leave.pending ? `${leave.pending} application(s) waiting for approval` : "No applications waiting for approval"}
      actions={<Link href={essPaths.leave} className="inline-flex min-h-6 min-w-6 items-center justify-center rounded px-1.5 text-xs font-medium text-accent-strong hover:underline focus-visible:outline-2 dark:text-accent">All balances</Link>}
    >
      {tracked.length === 0 ? (
        <p className="text-sm text-ink-faint">No leave entitlement is set up for you. Ask HR about your leave policy.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {tracked.map((b) => {
            const used = (b.taken + b.pending) / Math.max(b.quota ?? 1, 1);
            return (
              <li key={b.leaveType} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="truncate font-medium text-ink">{b.leaveType}</span>
                  <span className="shrink-0 text-ink-muted tabular-nums">
                    <span className="font-semibold text-ink">{b.remaining}</span> / {b.quota} left
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-control" role="presentation">
                  <div className={cn("h-full rounded-full", used >= 1 ? "bg-danger" : used > 0.75 ? "bg-warning" : "bg-accent-strong dark:bg-accent")} style={{ width: `${Math.min(used, 1) * 100}%` }} />
                </div>
                <span className="text-[11px] text-ink-faint">
                  {b.taken} taken{b.pending ? ` · ${b.pending} pending` : ""}
                  {b.carried ? ` · ${b.carried} carried forward` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {leave.upcoming.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <h3 className="mb-2 text-[11px] font-semibold tracking-wide text-ink-muted uppercase">Upcoming approved leave</h3>
          <ul className="flex flex-col gap-1.5 text-[13px]">
            {leave.upcoming.map((l) => (
              <li key={`${l.leaveType}-${l.fromDate}`} className="flex justify-between gap-2">
                <span className="text-ink">{l.leaveType}</span>
                <span className="text-ink-muted tabular-nums">
                  {fmtDate(l.fromDate)} – {fmtDate(l.toDate)} · {l.days}d
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

const ACTIONS = [
  { label: "Apply for Leave", href: essPaths.leaveApply, icon: CalendarPlus, needsActive: true },
  { label: "View Attendance", href: essPaths.attendance, icon: Clock },
  { label: "My Calendar", href: essPaths.calendar, icon: CalendarDays },
  { label: "Request Correction", href: essPaths.corrections, icon: ClipboardEdit, needsActive: true },
  { label: "My Payslips", href: essPaths.payslips, icon: ReceiptText },
  { label: "My Profile", href: essPaths.profile, icon: UserRound },
];

function QuickActions({ canApply }: { canApply: boolean }) {
  return (
    <Panel title="Quick Actions">
      <ul className="grid grid-cols-2 gap-2">
        {ACTIONS.filter((a) => canApply || !a.needsActive).map(({ label, href, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="flex min-h-11 items-center gap-2 rounded border border-line bg-canvas px-2.5 py-2 text-[12.5px] font-medium text-ink transition-colors hover:border-accent-line hover:bg-accent-soft focus-visible:outline-2">
              <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded border border-line bg-surface text-accent-strong dark:text-accent [&_svg]:size-3.5">
                <Icon />
              </span>
              <span className="min-w-0 leading-tight">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

const TONE_DOT = { success: "bg-success", warning: "bg-warning", danger: "bg-danger", neutral: "bg-ink-faint" } as const;

function Activities({ activities }: { activities: EssDashboard["activities"] }) {
  return (
    <Panel title="Recent Activity">
      {activities.length === 0 ? (
        <EmptyBlock icon={<FileText />} title="Nothing yet">
          Your leave applications, corrections and payslips will appear here.
        </EmptyBlock>
      ) : (
        <ol className="flex flex-col">
          {activities.map((a, i) => {
            const content = (
              <>
                <span aria-hidden="true" className={cn("mt-1.5 size-2 shrink-0 rounded-full", TONE_DOT[a.tone])} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-ink">{a.title}</span>
                  {a.detail && <span className="block truncate text-xs text-ink-muted">{a.detail}</span>}
                </span>
                <time dateTime={a.at} className="shrink-0 text-[11px] text-ink-faint">
                  {fmtDateTime(a.at)}
                </time>
              </>
            );
            return (
              <li key={`${a.at}-${i}`} className="border-b border-line last:border-b-0">
                {a.link ? (
                  <Link href={a.link} className="-mx-2 flex gap-3 rounded px-2 py-2.5 hover:bg-control focus-visible:outline-2">
                    {content}
                  </Link>
                ) : (
                  <div className="flex gap-3 py-2.5">{content}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

const KIND_STYLE = { work: "text-ink", off: "text-ink-faint", holiday: "text-ink-muted", leave: "text-accent-strong dark:text-accent", none: "text-ink-faint" } as const;

function Upcoming({ items }: { items: EssDashboard["upcoming"] }) {
  return (
    <Panel title="Upcoming Schedule" description="Next 14 days" actions={<Link href={essPaths.calendar} className="inline-flex min-h-6 min-w-6 items-center justify-center rounded px-1.5 text-xs font-medium text-accent-strong hover:underline focus-visible:outline-2 dark:text-accent">Calendar</Link>} flush>
      <ul className="max-h-80 overflow-y-auto">
        {items.map((u) => (
          <li key={u.date} className="flex items-center gap-3 border-b border-line px-5 py-2 last:border-b-0">
            <span className="w-14 shrink-0 text-xs text-ink-muted tabular-nums">
              <span className="block font-semibold text-ink">{u.day}</span>
              {fmtDate(u.date).slice(0, 6)}
            </span>
            <span className={cn("min-w-0 flex-1 truncate text-[13px]", KIND_STYLE[u.kind])}>{u.label}</span>
            {u.kind === "holiday" && <Badge>Holiday</Badge>}
            {u.kind === "leave" && <Badge variant="primary">Leave</Badge>}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Notices({ notices }: { notices: EssDashboard["notices"] }) {
  if (notices.length === 0) return null;
  return (
    <Panel title="Notice Board" actions={<Link href={essPaths.notifications} className="inline-flex min-h-6 min-w-6 items-center justify-center rounded px-1.5 text-xs font-medium text-accent-strong hover:underline focus-visible:outline-2 dark:text-accent">All</Link>}>
      <ul className="flex flex-col gap-3">
        {notices.map((n) => (
          <li key={n.id} className="flex gap-2.5">
            <Megaphone aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", n.priority === "Urgent" ? "text-danger" : n.priority === "Important" ? "text-warning" : "text-ink-faint")} />
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-ink">
                {n.title} {n.priority !== "Normal" && <Badge variant={n.priority === "Urgent" ? "danger" : "warning"}>{n.priority}</Badge>}
              </p>
              <p className="line-clamp-3 text-xs whitespace-pre-line text-ink-muted">{n.message}</p>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
