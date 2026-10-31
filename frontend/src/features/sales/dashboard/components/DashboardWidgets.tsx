"use client";

import {
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  ChevronUp,
  List,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/section";
import { EmptyState } from "@/features/sales/components/EmptyState";
import { cn } from "@/lib/cn";
import { paths } from "../../paths";
import { formatAmount, formatQty, percentOf } from "../lib/format";
import type { RankedEntry, SalesDashboard } from "../schemas/dashboard.schema";

/** Card with a title row; the dashboard's modular building block. */
export function Widget({
  title,
  subtitle,
  actions,
  className,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const generatedId = useId();
  const id = `widget-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${generatedId}`;

  return (
    <Card className={cn("flex flex-col border border-line bg-surface shadow-xs transition-shadow hover:shadow-sm", className)}>
      <section aria-labelledby={id} className="flex flex-1 flex-col p-4 sm:p-5">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-3">
          <div className="flex flex-col gap-0.5">
            <h2 id={id} className="text-sm font-semibold tracking-tight text-ink sm:text-base">
              {title}
            </h2>
            {subtitle && <div className="text-xs text-ink-faint">{subtitle}</div>}
          </div>
          {actions && <div className="flex items-center gap-1.5">{actions}</div>}
        </header>
        {children}
      </section>
    </Card>
  );
}

/** Tones for KPI stat tiles */
export type StatTone = "primary" | "success" | "warning" | "danger" | "purple";

export interface StatTileProps {
  label: string;
  value: number | string;
  hint?: string;
  subtitle?: ReactNode;
  badge?: { text: string; variant?: BadgeProps["variant"] };
  icon?: ReactNode;
  tone?: StatTone;
}

const TONE_STYLES: Record<
  StatTone,
  {
    bar: string;
    iconWrap: string;
    iconColor: string;
  }
> = {
  primary: {
    bar: "bg-primary",
    iconWrap: "bg-accent-soft border border-accent-line",
    iconColor: "text-accent-strong dark:text-accent",
  },
  success: {
    bar: "bg-success",
    iconWrap: "bg-success/10 border border-success/30",
    iconColor: "text-success",
  },
  warning: {
    bar: "bg-warning",
    iconWrap: "bg-warning/10 border border-warning/30",
    iconColor: "text-warning",
  },
  danger: {
    bar: "bg-danger",
    iconWrap: "bg-danger/10 border border-danger/30",
    iconColor: "text-danger",
  },
  purple: {
    bar: "bg-indigo-500",
    iconWrap: "bg-indigo-500/10 border border-indigo-500/30",
    iconColor: "text-indigo-600 dark:text-indigo-400",
  },
};

/** Headline metric tile with currency symbol, accent top bar, icon and subtitle */
export function StatTile({
  label,
  value,
  hint,
  subtitle,
  badge,
  icon,
  tone = "primary",
}: StatTileProps) {
  const styles = TONE_STYLES[tone] ?? TONE_STYLES.primary;
  const displayVal = typeof value === "number" ? `৳ ${formatAmount(value)}` : value;

  return (
    <div
      className="group relative flex flex-col justify-between overflow-hidden rounded-lg border border-line bg-surface p-4 shadow-xs transition-all hover:border-line-strong hover:shadow-sm"
      title={hint}
    >
      {/* Top accent indicator */}
      <span aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-1", styles.bar)} />

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-xs font-medium text-ink-muted">{label}</span>
          <span className="truncate text-xl font-bold tracking-tight text-ink tabular-nums sm:text-2xl">
            {displayVal}
          </span>
        </div>
        <span
          aria-hidden="true"
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg shadow-2xs transition-transform group-hover:scale-105",
            styles.iconWrap,
            styles.iconColor,
          )}
        >
          {icon ?? <TrendingUp className="size-5" />}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line/50 pt-2 text-xs">
        <span className="truncate text-ink-faint">{subtitle ?? hint ?? "—"}</span>
        {badge && <Badge variant={badge.variant ?? "neutral"}>{badge.text}</Badge>}
      </div>
    </div>
  );
}

const RADIUS = 64;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Achieved share of the target with an executive ring gauge and team breakdown */
export function TargetWidget({ data }: { data: SalesDashboard["target"] }) {
  const [showTeam, setShowTeam] = useState(false);
  const percent = percentOf(data.achieved, data.target);
  const share = percent === null ? 0 : Math.min(percent, 100) / 100;
  const remaining = Math.max(0, data.target - data.achieved);

  const status =
    percent === null
      ? null
      : percent >= 100
        ? { label: "Goal Exceeded", variant: "success" as const }
        : percent >= 75
          ? { label: "On Track", variant: "primary" as const }
          : { label: "Needs Attention", variant: "warning" as const };

  const strokeDash = `${share * CIRCUMFERENCE} ${CIRCUMFERENCE}`;

  return (
    <Widget
      title="Sales Target & Achievement"
      subtitle={status ? <Badge variant={status.variant}>{status.label}</Badge> : "No target period defined"}
    >
      {percent === null ? (
        <EmptyState title="No targets set">Add monthly targets in Sales Target to track performance here.</EmptyState>
      ) : (
        <div className="flex flex-1 flex-col justify-between gap-4">
          <div className="flex flex-col items-center justify-center gap-4 py-2">
            <figure className="relative flex items-center justify-center">
              <svg
                viewBox="0 0 170 170"
                className="size-44 sm:size-48"
                role="img"
                aria-label={`${percent}% achieved: ৳ ${formatAmount(data.achieved)} of ৳ ${formatAmount(data.target)}`}
              >
                {/* Background track */}
                <circle
                  cx="85"
                  cy="85"
                  r={RADIUS}
                  fill="none"
                  strokeWidth="16"
                  className="stroke-control dark:stroke-line"
                >
                  <title>{`Remaining: ৳ ${formatAmount(remaining)}`}</title>
                </circle>
                {/* Achieved arc */}
                {share > 0 && (
                  <circle
                    cx="85"
                    cy="85"
                    r={RADIUS}
                    fill="none"
                    strokeWidth="16"
                    strokeLinecap={share < 1 ? "round" : "butt"}
                    strokeDasharray={strokeDash}
                    transform="rotate(-90 85 85)"
                    className={cn(
                      "transition-all duration-700",
                      percent >= 100 ? "stroke-success" : percent >= 75 ? "stroke-accent" : "stroke-warning",
                    )}
                  >
                    <title>{`Achieved: ৳ ${formatAmount(data.achieved)} (${percent}%)`}</title>
                  </circle>
                )}
              </svg>
              <figcaption className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-extrabold tracking-tight text-ink tabular-nums sm:text-3xl">
                  {percent}%
                </span>
                <span className="text-xs font-medium text-ink-faint">of target achieved</span>
              </figcaption>
            </figure>

            {/* Target Breakdown Stats */}
            <div className="grid w-full grid-cols-3 gap-2 text-center">
              <div className="rounded-md border border-line bg-canvas p-2.5">
                <span className="block text-[11px] font-medium text-ink-muted">Achieved</span>
                <span className="block truncate text-xs font-bold text-success tabular-nums sm:text-sm">
                  ৳ {formatAmount(data.achieved)}
                </span>
              </div>
              <div className="rounded-md border border-line bg-canvas p-2.5">
                <span className="block text-[11px] font-medium text-ink-muted">Target</span>
                <span className="block truncate text-xs font-bold text-ink tabular-nums sm:text-sm">
                  ৳ {formatAmount(data.target)}
                </span>
              </div>
              <div className="rounded-md border border-line bg-canvas p-2.5">
                <span className="block text-[11px] font-medium text-ink-muted">Remaining</span>
                <span className="block truncate text-xs font-bold text-ink-muted tabular-nums sm:text-sm">
                  ৳ {formatAmount(remaining)}
                </span>
              </div>
            </div>
          </div>

          {/* Sales Team Performance Accordion */}
          {data.salesPersons && data.salesPersons.length > 0 && (
            <div className="border-t border-line/60 pt-3">
              <button
                type="button"
                onClick={() => setShowTeam((prev) => !prev)}
                className="flex w-full items-center justify-between rounded p-1.5 text-xs font-semibold text-ink-muted hover:bg-control hover:text-ink transition-colors"
                aria-expanded={showTeam}
              >
                <span className="flex items-center gap-1.5">
                  <Users className="size-3.5 text-accent-strong" />
                  <span>Sales Force Breakdown ({data.salesPersons.length})</span>
                </span>
                {showTeam ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              </button>

              {showTeam && (
                <div className="mt-2.5 flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
                  {data.salesPersons.map((person) => {
                    const personPct = percentOf(person.achieved, person.target) ?? 0;
                    return (
                      <div
                        key={person.salesPersonId}
                        className="flex flex-col gap-1 rounded border border-line bg-canvas/60 p-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[10px] font-bold text-accent-strong">
                              {person.name.charAt(0).toUpperCase()}
                            </span>
                            <span className="truncate font-medium text-ink">{person.name}</span>
                            {person.designation && (
                              <span className="text-[10px] text-ink-faint">({person.designation})</span>
                            )}
                          </div>
                          <span
                            className={cn(
                              "font-semibold tabular-nums",
                              personPct >= 100
                                ? "text-success"
                                : personPct >= 75
                                  ? "text-accent-strong"
                                  : "text-warning",
                            )}
                          >
                            {personPct}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-ink-faint">
                          <span>
                            Achieved: <span className="font-semibold text-ink">৳ {formatAmount(person.achieved)}</span>
                          </span>
                          <span>Target: ৳ {formatAmount(person.target)}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-control">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              personPct >= 100
                                ? "bg-success"
                                : personPct >= 75
                                  ? "bg-accent-strong"
                                  : "bg-warning",
                            )}
                            style={{ width: `${Math.min(100, personPct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Widget>
  );
}

/** Overdue and due today balances with tabs and quick-action buttons */
export function OverdueWidget({ data, className }: { data: SalesDashboard; className?: string }) {
  const [tab, setTab] = useState<"overdue" | "dueToday" | "combined">("overdue");

  const totalOverdue = useMemo(() => data.overdue.reduce((s, r) => s + r.overdue, 0), [data.overdue]);
  const totalDue = useMemo(() => data.overdue.reduce((s, r) => s + r.due, 0), [data.overdue]);
  const totalDueToday = useMemo(() => data.dueToday.reduce((s, r) => s + r.amount, 0), [data.dueToday]);

  return (
    <Widget
      title="Customer Receivables & Dues"
      subtitle={`As-of date: ${data.to}`}
      className={className}
      actions={
        <div className="flex items-center gap-1 rounded-md border border-line bg-control/60 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setTab("overdue")}
            className={cn(
              "rounded px-2 py-1 font-medium transition-colors",
              tab === "overdue"
                ? "bg-surface text-ink shadow-2xs font-semibold"
                : "text-ink-muted hover:text-ink",
            )}
          >
            Overdue ({data.overdue.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("dueToday")}
            className={cn(
              "rounded px-2 py-1 font-medium transition-colors",
              tab === "dueToday"
                ? "bg-surface text-ink shadow-2xs font-semibold"
                : "text-ink-muted hover:text-ink",
            )}
          >
            Due Today ({data.dueToday.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("combined")}
            className={cn(
              "rounded px-2 py-1 font-medium transition-colors hidden sm:inline-block",
              tab === "combined"
                ? "bg-surface text-ink shadow-2xs font-semibold"
                : "text-ink-muted hover:text-ink",
            )}
          >
            Combined
          </button>
        </div>
      }
    >
      {tab === "overdue" && (
        <div className="flex flex-1 flex-col justify-between gap-3">
          {data.overdue.length === 0 ? (
            <EmptyState title="No overdue customers">All customer balances are clear and up to date.</EmptyState>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-line bg-canvas text-ink-muted">
                      <th scope="col" className="px-3 py-2 font-semibold">Customer</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Overdue Amount</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Current Due</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Total Outstanding</th>
                      <th scope="col" className="px-2 py-2 text-center font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {data.overdue.map((row, i) => (
                      <tr key={row.customerId} className="hover:bg-control/50 transition-colors">
                        <td className="px-3 py-2 font-medium text-ink">
                          <div className="flex items-center gap-2">
                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-danger/10 text-[10px] font-bold text-danger">
                              {i + 1}
                            </span>
                            <span className="truncate max-w-[180px] sm:max-w-[240px]">{row.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-danger tabular-nums">
                          ৳ {formatAmount(row.overdue)}
                        </td>
                        <td className="px-3 py-2 text-right text-ink-muted tabular-nums">
                          ৳ {formatAmount(row.due)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-ink tabular-nums">
                          ৳ {formatAmount(row.overdue + row.due)}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <Link
                            href={paths.collectByInvoice(row.customerId)}
                            className={buttonClasses("secondary", "sm", "h-6 px-2 text-[11px]")}
                            title={`Collect payment from ${row.name}`}
                          >
                            Collect
                            <ArrowUpRight className="size-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-canvas/60 p-2.5 text-xs">
                <span className="font-medium text-ink-muted">Total Overdue Outstanding:</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-ink-faint">
                    Regular Due: <strong className="text-ink">৳ {formatAmount(totalDue)}</strong>
                  </span>
                  <span className="rounded bg-danger/10 px-2 py-0.5 font-bold text-danger tabular-nums">
                    ৳ {formatAmount(totalOverdue)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "dueToday" && (
        <div className="flex flex-1 flex-col justify-between gap-3">
          {data.dueToday.length === 0 ? (
            <EmptyState title="No payments due today">No customer invoices reach their due date today.</EmptyState>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-line bg-canvas text-ink-muted">
                      <th scope="col" className="px-3 py-2 font-semibold">Customer</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Amount Due Today</th>
                      <th scope="col" className="px-3 py-2 text-center font-semibold">Status</th>
                      <th scope="col" className="px-2 py-2 text-center font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {data.dueToday.map((row, i) => (
                      <tr key={row.customerId} className="hover:bg-control/50 transition-colors">
                        <td className="px-3 py-2 font-medium text-ink">
                          <div className="flex items-center gap-2">
                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-warning/10 text-[10px] font-bold text-warning">
                              {i + 1}
                            </span>
                            <span className="truncate max-w-[200px] sm:max-w-[280px]">{row.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-warning tabular-nums">
                          ৳ {formatAmount(row.amount)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Badge variant="warning">Due Today</Badge>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <Link
                            href={paths.collectByInvoice(row.customerId)}
                            className={buttonClasses("secondary", "sm", "h-6 px-2 text-[11px]")}
                            title={`Collect payment from ${row.name}`}
                          >
                            Collect
                            <ArrowUpRight className="size-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-line bg-canvas/60 p-2.5 text-xs">
                <span className="font-medium text-ink-muted">Total Due Today:</span>
                <span className="rounded bg-warning/10 px-2 py-0.5 font-bold text-warning tabular-nums">
                  ৳ {formatAmount(totalDueToday)}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "combined" && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[580px] border-collapse text-xs">
            <thead>
              <tr className="bg-control text-ink">
                <th scope="colgroup" colSpan={3} className="border border-line px-3 py-1.5 text-center font-semibold text-danger">
                  Overdue Accounts
                </th>
                <th scope="colgroup" colSpan={2} className="border border-line px-3 py-1.5 text-center font-semibold text-warning">
                  Today&apos;s Due Accounts
                </th>
              </tr>
              <tr className="bg-canvas text-ink-muted">
                <th scope="col" className="border border-line px-2 py-1.5 font-semibold">Customer</th>
                <th scope="col" className="border border-line px-2 py-1.5 text-right font-semibold">OD Amount</th>
                <th scope="col" className="border border-line px-2 py-1.5 text-right font-semibold">Due</th>
                <th scope="col" className="border border-line px-2 py-1.5 font-semibold">Customer</th>
                <th scope="col" className="border border-line px-2 py-1.5 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.max(data.overdue.length, data.dueToday.length) }, (_, index) => {
                const overdue = data.overdue[index];
                const today = data.dueToday[index];
                return (
                  <tr key={index} className="hover:bg-control/50">
                    <td className="border border-line px-2 py-1.5 text-ink truncate max-w-[140px]">
                      {overdue?.name ?? "—"}
                    </td>
                    <td className="border border-line px-2 py-1.5 text-right font-semibold text-danger tabular-nums">
                      {overdue ? `৳ ${formatAmount(overdue.overdue)}` : "—"}
                    </td>
                    <td className="border border-line px-2 py-1.5 text-right text-ink-muted tabular-nums">
                      {overdue ? `৳ ${formatAmount(overdue.due)}` : "—"}
                    </td>
                    <td className="border border-line px-2 py-1.5 text-ink truncate max-w-[140px]">
                      {today?.name ?? "—"}
                    </td>
                    <td className="border border-line px-2 py-1.5 text-right font-semibold text-warning tabular-nums">
                      {today ? `৳ ${formatAmount(today.amount)}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Widget>
  );
}

/** Avatar tints for top ranking cards */
const AVATAR_TINTS = [
  "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30",
  "bg-slate-400/15 text-slate-600 dark:text-slate-300 border border-slate-400/30",
  "bg-amber-700/15 text-amber-700 dark:text-amber-300 border border-amber-700/30",
  "bg-accent-soft text-accent-strong border border-accent-line",
  "bg-success/10 text-success border border-success/30",
  "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30",
];

const compactNumber = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** Top 10 list as sleek ranking cards with visual progress bars and chart view toggle */
export function RankedWidget({
  title,
  rows,
  empty,
  className,
  kind = "item",
}: {
  title: string;
  rows: RankedEntry[];
  empty: string;
  className?: string;
  kind?: "item" | "customer" | "person";
}) {
  const [view, setView] = useState<"list" | "chart">("list");

  const maxAmount = useMemo(() => Math.max(...rows.map((r) => r.amount), 1), [rows]);

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        name: r.name.length > 16 ? `${r.name.slice(0, 15)}…` : r.name,
        fullName: r.name,
        detail: r.detail,
        amount: r.amount,
        qty: r.qty,
      })),
    [rows],
  );

  return (
    <Widget
      title={title}
      subtitle={rows.length > 0 ? `${rows.length} top performers` : undefined}
      className={className}
      actions={
        rows.length > 0 ? (
          <div className="flex items-center gap-1 rounded-md border border-line bg-control/60 p-0.5">
            <button
              type="button"
              onClick={() => setView("list")}
              className={cn(
                "flex size-6 items-center justify-center rounded transition-colors",
                view === "list" ? "bg-surface text-ink shadow-2xs" : "text-ink-muted hover:text-ink",
              )}
              title="List view"
            >
              <List className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setView("chart")}
              className={cn(
                "flex size-6 items-center justify-center rounded transition-colors",
                view === "chart" ? "bg-surface text-ink shadow-2xs" : "text-ink-muted hover:text-ink",
              )}
              title="Chart view"
            >
              <BarChart3 className="size-3.5" />
            </button>
          </div>
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <EmptyState title={empty} />
      ) : view === "chart" ? (
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 16, left: 4, bottom: 0 }}
            >
              <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={(v) => `৳${compactNumber.format(v)}`}
                tick={{ fill: "var(--color-ink-muted)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={110}
                tick={{ fill: "var(--color-ink)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload;
                    return (
                      <div className="rounded border border-line bg-surface p-2 shadow-md text-xs">
                        <p className="font-semibold text-ink">{item.fullName}</p>
                        {item.detail && <p className="text-[11px] text-ink-faint mb-1">{item.detail}</p>}
                        <div className="flex items-center gap-2 text-ink-muted">
                          <span>Amount:</span>
                          <strong className="text-success tabular-nums">৳ {formatAmount(item.amount)}</strong>
                        </div>
                        <div className="flex items-center gap-2 text-ink-muted">
                          <span>Quantity:</span>
                          <span className="font-medium text-ink tabular-nums">{formatQty(item.qty)}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="amount"
                name="Sales Amount"
                fill="var(--color-accent)"
                radius={[0, 4, 4, 0]}
                barSize={12}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((row, index) => {
            const share = Math.round((row.amount / maxAmount) * 100);
            return (
              <li
                key={row.id}
                title={`${index + 1}. ${row.name}${row.detail ? ` (${row.detail})` : ""}: ৳ ${formatAmount(row.amount)} · ${formatQty(row.qty)} Qty`}
                className="group relative flex flex-col gap-1.5 rounded-lg border border-line bg-canvas/70 p-2.5 transition-all hover:border-line-strong hover:bg-surface hover:shadow-2xs"
              >
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    {/* Rank pill / badge */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-bold tabular-nums",
                        AVATAR_TINTS[index % AVATAR_TINTS.length],
                      )}
                    >
                      {index + 1}
                    </span>

                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-xs font-semibold text-ink sm:text-sm">
                        {row.name}
                      </span>
                      {row.detail && (
                        <span className="truncate text-[10px] text-ink-faint">
                          {row.detail}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end">
                    <span className="text-xs font-bold text-success tabular-nums sm:text-sm">
                      ৳ {formatAmount(row.amount)}
                    </span>
                    <span className="text-[10px] text-ink-faint tabular-nums">
                      {formatQty(row.qty)} {kind === "item" ? "Units" : "Qty"}
                    </span>
                  </div>
                </div>

                {/* Relative progress bar */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-control">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      index === 0
                        ? "bg-accent-strong"
                        : index === 1
                          ? "bg-accent"
                          : "bg-accent/70",
                    )}
                    style={{ width: `${share}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Widget>
  );
}
