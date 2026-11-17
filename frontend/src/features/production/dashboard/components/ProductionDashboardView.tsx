"use client";

import { ArrowUpRight, BadgeCheck, Coins, Package, RefreshCw, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/form-field";
import { Card, ErrorState, LoadingState } from "@/components/ui/section";
import { EmptyState } from "@/features/production/components/EmptyState";
import { ORDER_STATUS_LABELS } from "@/features/production/orders/schemas/order.schema";
import { paths } from "@/features/production/paths";
import { StatTile, Widget } from "@/features/sales/dashboard/components/DashboardWidgets";
import { formatAmount, formatQty, percentOf } from "@/features/sales/dashboard/lib/format";
import { useToday } from "@/features/sales/lib/use-today";
import { fetchSalesLookups } from "@/features/sales/masters/services/masters.api";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import {
  DASHBOARD_ORDER_STATUSES,
  productionDashboardQuerySchema,
  type DailyOutput,
  type DashboardOrderStatus,
  type ProductionDashboard,
  type ProductionDashboardQuery,
} from "../schemas/dashboard.schema";
import { fetchProductionDashboard } from "../services/dashboard.api";

/** Production Dashboard. Waits for the browser's date before loading. */
export function ProductionDashboardView() {
  const today = useToday();
  return (
    <PageContainer className="max-w-none">
      <PageHead title="Production Dashboard" subtitle="Output, quality, material cost and the order pipeline." />
      {today ? <Dashboard today={today} /> : <LoadingState />}
    </PageContainer>
  );
}

function Dashboard({ today }: { today: string }) {
  const lookups = useResource("sales-lookups", fetchSalesLookups);
  const [form, setForm] = useState({ officeId: "", from: `${today.slice(0, 8)}01`, to: today });
  const [query, setQuery] = useState<ProductionDashboardQuery>({ from: form.from, to: form.to });
  const [formError, setFormError] = useState<string>();
  // Entries and orders are posted from other screens, so refresh when the user comes back.
  const dashboard = useResource(`production-dashboard:${JSON.stringify(query)}`, () => fetchProductionDashboard(query), { refreshOnFocus: true });

  function view(event: FormEvent) {
    event.preventDefault();
    const next = { from: form.from, to: form.to, ...(form.officeId ? { officeId: form.officeId } : {}) };
    const parsed = productionDashboardQuerySchema.safeParse(next);
    if (!parsed.success) return setFormError(parsed.error.issues[0]?.message);
    setFormError(undefined);
    if (JSON.stringify(next) === JSON.stringify(query)) dashboard.reload();
    else setQuery(next);
  }

  const data = dashboard.data;
  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <form onSubmit={view} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <SelectField
            label="Office"
            value={form.officeId}
            options={[{ value: "", label: "All" }, ...(lookups.data?.offices ?? []).map((office) => ({ value: office.id, label: office.name }))]}
            onChange={(event) => setForm({ ...form, officeId: event.target.value })}
          />
          <TextField label="From Date" type="date" required value={form.from} max={form.to} onChange={(event) => setForm({ ...form, from: event.target.value })} />
          <TextField label="To Date" type="date" required value={form.to} min={form.from} onChange={(event) => setForm({ ...form, to: event.target.value })} />
          <Button type="submit" variant="primary" loading={dashboard.loading} className="max-sm:h-11">
            {!dashboard.loading && <RefreshCw aria-hidden="true" />}
            View
          </Button>
          {formError && (
            <p role="alert" className="text-xs text-danger sm:col-span-4">
              {formError}
            </p>
          )}
        </form>
      </Card>

      {dashboard.error && !data ? (
        <Card>
          <ErrorState message={errorMessage(dashboard.error)} onRetry={dashboard.reload} />
        </Card>
      ) : !data ? (
        <Card>
          <LoadingState label="Loading dashboard…" />
        </Card>
      ) : (
        <div className={cn("flex flex-col gap-4 transition-opacity", dashboard.loading && "opacity-60")} aria-busy={dashboard.loading}>
          {dashboard.error && (
            <p role="alert" className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              Could not refresh: {errorMessage(dashboard.error)}
            </p>
          )}
          <Stats data={data} />
          <div className="grid gap-4 lg:grid-cols-3">
            <DailyOutputWidget data={data} className="lg:col-span-2" />
            <OrdersWidget data={data} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <TopList
              title="Top Produced Items"
              subtitle="Top 5 by quantity produced"
              empty="Nothing produced in this range"
              rows={data.topItems.map((row) => ({
                key: row.itemId,
                title: row.name,
                detail: row.code,
                amount: row.qty,
                value: `${formatQty(row.qty)} ${row.uom}`.trim(),
              }))}
            />
            <TopList
              title="Top Machines"
              subtitle="Top 5 work centers by output"
              empty="No machine has logged output in this range"
              rows={data.topWorkCenters.map((row) => ({
                key: row.workCenterId,
                title: row.name,
                detail: `${row.code} · ${formatQty(row.hours)} run hours${row.productivity === null ? "" : ` · ${formatAmount(row.productivity)} unit/hour`}`,
                amount: row.qty,
                value: formatQty(row.qty),
              }))}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Stats({ data }: { data: ProductionDashboard }) {
  const variance = data.variance;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile
        tone="primary"
        icon={<Package className="size-5" />}
        label="Production Volume (Unit)"
        value={formatQty(data.volume)}
        subtitle={`${data.entries} production ${data.entries === 1 ? "entry" : "entries"}`}
      />
      <StatTile
        tone={data.rejectQty > 0 ? "warning" : "success"}
        icon={<BadgeCheck className="size-5" />}
        label="Good Output (Unit)"
        value={formatQty(data.goodQty)}
        subtitle={`${formatQty(data.rejectQty)} rejected`}
        badge={data.rejectRate === null ? undefined : { text: `${data.rejectRate}% reject`, variant: data.rejectQty > 0 ? "warning" : "success" }}
      />
      <StatTile
        tone="primary"
        icon={<TrendingUp className="size-5" />}
        label="Productivity (Unit per hour)"
        value={formatAmount(data.productivity)}
        subtitle={`${formatQty(data.hours)} machine hours`}
      />
      <StatTile
        tone={variance > 0 ? "danger" : "success"}
        icon={<Coins className="size-5" />}
        label="Material Cost Variance"
        value={`৳ ${formatAmount(Math.abs(variance))}`}
        subtitle={`Actual ৳ ${formatAmount(data.actualCost)} · Standard ৳ ${formatAmount(data.standardCost)}`}
        badge={
          data.entries === 0
            ? undefined
            : variance > 0
              ? { text: "Over standard", variant: "danger" }
              : variance < 0
                ? { text: "Under standard", variant: "success" }
                : { text: "On standard", variant: "neutral" }
        }
      />
    </div>
  );
}

/** Longest range drawn with one bar per calendar day; longer ranges show only days with output. */
const MAX_FILLED_DAYS = 62;
const DAY_MS = 86_400_000;
const dayLabel = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
const compactNumber = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function dailySeries(from: string, to: string, daily: DailyOutput[]) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - start) / DAY_MS) + 1;
  const byDate = new Map(daily.map((row) => [row.date, row]));
  const dates = days <= MAX_FILLED_DAYS ? Array.from({ length: days }, (_, index) => new Date(start + index * DAY_MS).toISOString().slice(0, 10)) : daily.map((row) => row.date);
  return {
    filled: days <= MAX_FILLED_DAYS,
    rows: dates.map((date) => {
      const row = byDate.get(date);
      return { date, label: dayLabel.format(new Date(`${date}T00:00:00Z`)), qty: row?.qty ?? 0, rejectQty: row?.rejectQty ?? 0 };
    }),
  };
}

function DailyOutputWidget({ data, className }: { data: ProductionDashboard; className?: string }) {
  const series = useMemo(() => dailySeries(data.from, data.to, data.daily), [data.from, data.to, data.daily]);
  return (
    <Widget title="Daily Output" subtitle={series.filled ? "Units produced per day" : "Units produced per day (days with output only)"} className={className}>
      {data.daily.length === 0 ? (
        <EmptyState title="No production in this range" subtitle="Posted production entries appear here by day.">
          <Link href={paths.entries} className={buttonClasses("secondary", "sm", "mt-1")}>
            Production Entry
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </EmptyState>
      ) : (
        <div className="h-64 w-full" role="img" aria-label={`Daily output from ${data.from} to ${data.to}: ${formatQty(data.volume)} units over ${data.daily.length} production days`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series.rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "var(--color-ink-muted)", fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={16} />
              <YAxis width={44} tickFormatter={(value: number) => compactNumber.format(value)} tick={{ fill: "var(--color-ink-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: "var(--color-control)" }}
                content={({ active, payload }) => {
                  const row = active ? (payload?.[0]?.payload as (typeof series.rows)[number] | undefined) : undefined;
                  if (!row) return null;
                  return (
                    <div className="rounded border border-line bg-surface p-2 text-xs shadow-md">
                      <p className="font-semibold text-ink">{row.date}</p>
                      <p className="text-ink-muted">
                        Produced: <strong className="text-ink tabular-nums">{formatQty(row.qty)}</strong>
                      </p>
                      <p className="text-ink-muted">
                        Rejected: <span className="font-medium text-ink tabular-nums">{formatQty(row.rejectQty)}</span>
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="qty" name="Produced" fill="var(--color-accent-strong)" radius={[3, 3, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Widget>
  );
}

const STATUS_DOTS: Record<DashboardOrderStatus, string> = {
  PENDING_APPROVAL: "bg-warning",
  APPROVED: "bg-accent",
  IN_PROGRESS: "bg-accent-strong",
  CLOSED: "bg-success",
  REJECTED: "bg-danger",
  CANCELLED: "bg-ink-faint",
};

function OrdersWidget({ data }: { data: ProductionDashboard }) {
  const { byStatus, open, pendingApproval } = data.orders;
  const total = DASHBOARD_ORDER_STATUSES.reduce((sum, status) => sum + byStatus[status], 0);
  const percent = percentOf(open.producedQty, open.orderQty);
  const remaining = Math.max(0, open.orderQty - open.producedQty);
  return (
    <Widget
      title="Production Orders"
      subtitle={`${total} ordered in this range`}
      actions={
        <Link href={paths.orders} className={buttonClasses("secondary", "sm")}>
          Orders
          <ArrowUpRight aria-hidden="true" />
        </Link>
      }
    >
      <div className="flex flex-1 flex-col gap-4">
        <div className="rounded-md border border-line bg-canvas p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-ink-muted">Open now (approved / in progress)</span>
            <span className="text-sm font-semibold text-ink tabular-nums">{open.count}</span>
          </div>
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-control"
            role="progressbar"
            aria-label="Produced share of open orders"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(percent ?? 0, 100)}
          >
            <div className="h-full rounded-full bg-accent-strong transition-all duration-500" style={{ width: `${Math.min(percent ?? 0, 100)}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-ink-faint">
            {open.count === 0
              ? "No order is waiting to be produced."
              : `${formatQty(open.producedQty)} of ${formatQty(open.orderQty)} produced (${percent ?? 0}%) · ${formatQty(remaining)} remaining`}
          </p>
          {pendingApproval > 0 && (
            <p className="mt-1 text-xs font-medium text-warning">
              {pendingApproval} {pendingApproval === 1 ? "order is" : "orders are"} waiting for approval.
            </p>
          )}
        </div>

        <ul className="flex flex-col divide-y divide-line/60">
          {DASHBOARD_ORDER_STATUSES.map((status) => (
            <li key={status} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
              <span className="flex items-center gap-2 text-ink">
                <span aria-hidden="true" className={cn("size-2 rounded-full", STATUS_DOTS[status])} />
                {ORDER_STATUS_LABELS[status]}
              </span>
              <span className={cn("font-semibold tabular-nums", byStatus[status] === 0 ? "text-ink-faint" : "text-ink")}>{byStatus[status]}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto grid grid-cols-2 gap-2 border-t border-line/60 pt-3">
          <MasterLink href={paths.workCenters} count={data.masters.workCenters} label="Active work centers" />
          <MasterLink href={paths.billOfMaterials} count={data.masters.boms} label="Active BOMs" />
        </div>
      </div>
    </Widget>
  );
}

function MasterLink({ href, count, label }: { href: string; count: number; label: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-11 flex-col rounded-md border border-line bg-canvas px-3 py-2 transition-colors hover:border-line-strong hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <span className="text-sm font-semibold text-ink tabular-nums">{count}</span>
      <span className="text-xs font-medium text-ink-muted">{label}</span>
    </Link>
  );
}

function TopList({
  title,
  subtitle,
  empty,
  rows,
}: {
  title: string;
  subtitle: string;
  empty: string;
  rows: { key: string; title: string; detail: string; amount: number; value: string }[];
}) {
  const max = Math.max(...rows.map((row) => row.amount), 1);
  return (
    <Widget title={title} subtitle={subtitle}>
      {rows.length === 0 ? (
        <EmptyState title={empty} />
      ) : (
        <ol className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <li key={row.key} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2.5">
                <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-md border border-accent-line bg-accent-soft text-xs font-bold text-accent-strong tabular-nums dark:text-accent">
                  {index + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold text-ink" title={row.title}>
                    {row.title}
                  </span>
                  <span className="truncate text-xs text-ink-faint">{row.detail}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-ink tabular-nums">{row.value}</span>
              </div>
              <div aria-hidden="true" className="h-1.5 w-full overflow-hidden rounded-full bg-control">
                <div className="h-full rounded-full bg-accent-strong transition-all duration-500" style={{ width: `${Math.round((row.amount / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Widget>
  );
}
