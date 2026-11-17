"use client";

import { Link2Off } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useResource } from "@/hooks/use-resource";
import { cn } from "@/lib/cn";
import { Panel } from "@/features/configuration/entity-master-data/employee/components/kit";
import { essApi } from "../api";
import { essPaths } from "../navigation";
import type { EssDayStatus, EssEmployee } from "../types";

// ─── Formatting ───────────────────────────────────────────────────────────────

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-11-05" → "05 Nov 2026". */
export const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d} ${MONTHS[Number(m) - 1]?.slice(0, 3)} ${y}`;
};
export const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
export const monthTitle = (month: string) => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
export const fmtMoney = (value: number) => value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** 95 → "1h 35m". */
export const fmtMinutes = (m: number | null | undefined) => (m === null || m === undefined ? "—" : m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`);
/** "13:30" → "01:30 PM". */
export const fmtClock = (hhmm: string | null | undefined) => {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return hhmm || "—";
  const h = Number(hhmm.slice(0, 2));
  return `${String(((h + 11) % 12) + 1).padStart(2, "0")}:${hhmm.slice(3)} ${h < 12 ? "AM" : "PM"}`;
};

/** Today in the browser, YYYY-MM-DD (the server works in the company time zone; the pages only use this as a default). */
export const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

// ─── Status ───────────────────────────────────────────────────────────────────

export const DAY_STATUS: Record<EssDayStatus, { variant: "success" | "warning" | "danger" | "primary" | "neutral"; dot: string }> = {
  Present: { variant: "success", dot: "bg-success" },
  Late: { variant: "warning", dot: "bg-warning" },
  Absent: { variant: "danger", dot: "bg-danger" },
  Leave: { variant: "primary", dot: "bg-accent-strong dark:bg-accent" },
  Holiday: { variant: "neutral", dot: "bg-ink-muted" },
  "Weekly Off": { variant: "neutral", dot: "bg-ink-faint" },
  Pending: { variant: "neutral", dot: "border border-ink-muted bg-transparent" },
  Upcoming: { variant: "neutral", dot: "border border-line-strong bg-transparent" },
  "No Schedule": { variant: "neutral", dot: "border border-dashed border-ink-faint bg-transparent" },
};

export function DayStatusBadge({ status, provisional }: { status: EssDayStatus; provisional?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Badge variant={DAY_STATUS[status].variant}>{status}</Badge>
      {provisional && status !== "Upcoming" && (
        <Badge variant="neutral" title="Today's attendance can still change.">
          Provisional
        </Badge>
      )}
    </span>
  );
}

const APPLICATION_VARIANT: Record<string, "success" | "warning" | "danger" | "neutral"> = { Pending: "warning", Approved: "success", Rejected: "danger", Cancelled: "neutral" };

export function RequestStatusBadge({ status }: { status: string }) {
  return <Badge variant={APPLICATION_VARIANT[status] ?? "neutral"}>{status}</Badge>;
}

// ─── Page frame ───────────────────────────────────────────────────────────────

/**
 * Every ESS page: title bar, then the page body once the login is known to be
 * linked to an employee. Without a link, a dedicated screen explains what to do
 * and nothing of the employee module is requested.
 */
export function EssPage({ title, subtitle, actions, children }: { title: string; subtitle?: ReactNode; actions?: ReactNode; children: (employee: EssEmployee) => ReactNode }) {
  const me = useResource("ess-me", essApi.me);
  return (
    <PageContainer>
      <PageHead title={title} subtitle={subtitle} actions={me.data?.linked ? actions : undefined} breadcrumbs={[{ label: "My Workspace", href: essPaths.dashboard }, { label: title, href: "#" }]} />
      {me.error ? (
        <Panel>
          <ErrorState message={me.error.message} onRetry={me.reload} />
        </Panel>
      ) : !me.data ? (
        <Panel>
          <LoadingState label="Loading your workspace…" />
        </Panel>
      ) : !me.data.linked ? (
        <LinkRequired message={me.data.message} />
      ) : (
        <div className="flex flex-col gap-4">{children(me.data.employee)}</div>
      )}
    </PageContainer>
  );
}

export function LinkRequired({ message }: { message: string }) {
  return (
    <section className="mx-auto mt-6 flex max-w-lg flex-col items-center gap-3 rounded border border-line bg-surface px-6 py-10 text-center shadow-xs">
      <span className="flex size-12 items-center justify-center rounded-full bg-warning/10 text-warning [&_svg]:size-6">
        <Link2Off aria-hidden="true" />
      </span>
      <h2 className="text-base font-semibold text-ink">Employee record not linked</h2>
      <p className="text-sm text-ink-muted">{message}</p>
      <p className="text-xs text-ink-faint">HR links a login to an employee in Configuration › Employee › ERP Access. Until then, no employee information is shown here.</p>
      <Link href="/" className={buttonClasses("secondary", "md", "mt-2")}>
        Go to Home
      </Link>
    </section>
  );
}

/** Small figure tile: label, value and an optional note. */
export function StatTile({ label, value, note, tone = "neutral", href }: { label: string; value: ReactNode; note?: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "primary"; href?: string }) {
  const bar = { neutral: "bg-line-strong", success: "bg-success", warning: "bg-warning", danger: "bg-danger", primary: "bg-accent-strong dark:bg-accent" }[tone];
  const body = (
    <>
      <span aria-hidden="true" className={cn("absolute inset-y-3 left-0 w-0.5 rounded-r", bar)} />
      <span className="text-xs font-medium text-ink-muted">{label}</span>
      <span className="text-xl font-bold tracking-tight text-ink tabular-nums">{value}</span>
      {note && <span className="text-[11px] text-ink-faint">{note}</span>}
    </>
  );
  const cls = "relative flex min-w-0 flex-col gap-0.5 rounded border border-line bg-surface px-4 py-3 shadow-xs";
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:border-line-strong hover:bg-control/40 focus-visible:outline-2")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Month and year pickers with previous/next buttons. */
export function MonthPicker({ value, onChange, idPrefix }: { value: string; onChange: (month: string) => void; idPrefix: string }) {
  const year = Number(value.slice(0, 4));
  const years = Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() + 1 - i));
  if (!years.includes(String(year))) years.push(String(year));
  const select = "h-8 rounded border border-line-strong bg-surface px-2 text-[12px] text-ink focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none";
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idPrefix}-month`} className="text-xs font-medium text-ink-muted">
          Month
        </label>
        <select id={`${idPrefix}-month`} className={select} value={value.slice(5, 7)} onChange={(e) => onChange(`${value.slice(0, 4)}-${e.target.value}`)}>
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1).padStart(2, "0")}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idPrefix}-year`} className="text-xs font-medium text-ink-muted">
          Year
        </label>
        <select id={`${idPrefix}-year`} className={select} value={String(year)} onChange={(e) => onChange(`${e.target.value}-${value.slice(5, 7)}`)}>
          {years.sort().reverse().map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/** Client-side pages over an already-loaded list. */
export function usePaged<T>(rows: readonly T[], initialSize = 15) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, totalPages);
  return {
    rows: rows.slice((current - 1) * pageSize, current * pageSize),
    page: current,
    pageSize,
    totalPages,
    totalRecords: rows.length,
    setPage,
    setPageSize: (size: number) => {
      setPageSize(size);
      setPage(1);
    },
  };
}
