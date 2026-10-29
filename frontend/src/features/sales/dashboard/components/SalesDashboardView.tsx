"use client";

import {
  AlertCircle,
  BarChart3,
  CalendarCheck,
  CalendarDays,
  Filter,
  Plus,
  RefreshCw,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, ErrorState, LoadingState } from "@/components/ui/section";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { paths } from "../../paths";
import { useToday } from "../../lib/use-today";
import { formatAmount } from "../lib/format";
import { dashboardQuerySchema, type DashboardQuery } from "../schemas/dashboard.schema";
import { fetchSalesDashboard } from "../services/dashboard.api";
import { OverdueWidget, RankedWidget, StatTile, TargetWidget } from "./DashboardWidgets";

/** Sales Dashboard. Waits for the browser's date (see useToday) before loading. */
export function SalesDashboardView() {
  const today = useToday();
  return (
    <PageContainer full className="space-y-4">
      {today ? <Dashboard today={today} /> : <LoadingState label="Initializing Sales Dashboard…" />}
    </PageContainer>
  );
}

interface DatePreset {
  label: string;
  from: string;
  to: string;
}

function getPresets(today: string): DatePreset[] {
  const [yearStr, monthStr, dayStr] = today.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr); // 1-12
  const day = Number(dayStr);

  const todayDate = new Date(Date.UTC(year, month - 1, day));

  // 7 days ago
  const sevenDaysAgo = new Date(todayDate);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);
  const last7DaysFrom = sevenDaysAgo.toISOString().slice(0, 10);

  // 30 days ago
  const thirtyDaysAgo = new Date(todayDate);
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 29);
  const last30DaysFrom = thirtyDaysAgo.toISOString().slice(0, 10);

  // This month
  const thisMonthFrom = `${today.slice(0, 7)}-01`;

  // Last month
  const lastMonthYear = month === 1 ? year - 1 : year;
  const lastMonthNum = month === 1 ? 12 : month - 1;
  const lastMonthStr = String(lastMonthNum).padStart(2, "0");
  const lastMonthFrom = `${lastMonthYear}-${lastMonthStr}-01`;
  const lastDayOfLastMonth = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  const lastMonthTo = `${lastMonthYear}-${lastMonthStr}-${String(lastDayOfLastMonth).padStart(2, "0")}`;

  // This quarter
  const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
  const thisQuarterFrom = `${yearStr}-${String(quarterStartMonth).padStart(2, "0")}-01`;

  // This Year (YTD)
  const ytdFrom = `${yearStr}-01-01`;

  return [
    { label: "Today", from: today, to: today },
    { label: "Last 7 Days", from: last7DaysFrom, to: today },
    { label: "This Month", from: thisMonthFrom, to: today },
    { label: "Last Month", from: lastMonthFrom, to: lastMonthTo },
    { label: "Last 30 Days", from: last30DaysFrom, to: today },
    { label: "This Quarter", from: thisQuarterFrom, to: today },
    { label: "This Year (YTD)", from: ytdFrom, to: today },
  ];
}

function Dashboard({ today }: { today: string }) {
  const defaultFrom = `${today.slice(0, 7)}-01`;
  const [form, setForm] = useState({ from: defaultFrom, to: today });
  const [query, setQuery] = useState<DashboardQuery>(form);
  const [formError, setFormError] = useState<string>();

  const presets = useMemo(() => getPresets(today), [today]);

  const { data, error, loading, reload } = useResource(
    `${query.from}|${query.to}`,
    () => fetchSalesDashboard(query),
    {
      refreshOnFocus: true,
      refreshInterval: 60_000,
    },
  );

  function applyDateRange(from: string, to: string) {
    const next = { from, to };
    const parsed = dashboardQuerySchema.safeParse(next);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message);
      return;
    }
    setFormError(undefined);
    setForm(next);
    if (parsed.data.from === query.from && parsed.data.to === query.to) {
      reload();
    } else {
      setQuery(parsed.data);
    }
  }

  function view(event: FormEvent) {
    event.preventDefault();
    applyDateRange(form.from, form.to);
  }

  const rangeDays = useMemo(() => {
    const start = new Date(query.from).getTime();
    const end = new Date(query.to).getTime();
    return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
  }, [query.from, query.to]);

  const totalOverdue = useMemo(
    () => data?.overdue.reduce((s, r) => s + r.overdue, 0) ?? 0,
    [data?.overdue],
  );

  const totalDueToday = useMemo(
    () => data?.dueToday.reduce((s, r) => s + r.amount, 0) ?? 0,
    [data?.dueToday],
  );

  const collectionRatio = useMemo(() => {
    if (!data || data.totals.sales <= 0) return null;
    return Math.round((data.totals.collection / data.totals.sales) * 100);
  }, [data]);

  return (
    <div className="flex flex-col gap-4">
      {/* Page Header with Quick Actions */}
      <PageHead
        title="Sales Dashboard"
        subtitle="Sales performance, collections, dues and top performers."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={reload}
              disabled={loading}
              title="Refresh dashboard metrics"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} aria-hidden="true" />
              Refresh
            </Button>
            <Link
              href={paths.reports}
              className={buttonClasses("secondary", "sm")}
              title="View full sales reports and analytics"
            >
              <BarChart3 className="size-3.5" aria-hidden="true" />
              Reports & Analytics
            </Link>
            <Link
              href={paths.newOrder}
              className={buttonClasses("primary", "sm")}
              title="Create a new sales order"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              New Order
            </Link>
          </div>
        }
      />

      {/* Enterprise Filter Toolbar */}
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-ink">
            <Filter className="size-3.5 text-accent-strong" />
            <span>Date Range & Analytics Filters</span>
          </div>

          {/* Quick Presets Pills */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-[11px] font-medium text-ink-faint">Presets:</span>
            {presets.map((preset) => {
              const active = form.from === preset.from && form.to === preset.to;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyDateRange(preset.from, preset.to)}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
                    active
                      ? "bg-accent-soft text-accent-strong dark:text-accent font-semibold shadow-2xs border border-accent-line"
                      : "bg-control text-ink-muted hover:bg-hover hover:text-ink",
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={view} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div className="flex flex-col gap-1">
            <label htmlFor="dashboard-from" className="text-xs font-medium text-ink-muted">
              From Date
            </label>
            <div className="relative">
              <input
                id="dashboard-from"
                type="date"
                required
                value={form.from}
                max={form.to}
                onChange={(e) => setForm({ ...form, from: e.target.value })}
                className="h-8 w-full rounded border border-line-strong bg-control px-2.5 text-xs text-ink transition-colors focus:border-accent focus:bg-surface focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="dashboard-to" className="text-xs font-medium text-ink-muted">
              To Date
            </label>
            <div className="relative">
              <input
                id="dashboard-to"
                type="date"
                required
                value={form.to}
                min={form.from}
                onChange={(e) => setForm({ ...form, to: e.target.value })}
                className="h-8 w-full rounded border border-line-strong bg-control px-2.5 text-xs text-ink transition-colors focus:border-accent focus:bg-surface focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" variant="primary" disabled={loading} className="w-full sm:w-auto">
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} aria-hidden="true" />
              Apply Filter
            </Button>
          </div>

          {formError && (
            <p role="alert" className="text-xs font-medium text-danger sm:col-span-3">
              {formError}
            </p>
          )}
        </form>

        {/* Applied filter badge banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-2 text-[11px] text-ink-faint">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5 text-accent-strong" />
            <span>
              Applied Period: <strong className="text-ink">{query.from}</strong> to{" "}
              <strong className="text-ink">{query.to}</strong> ({rangeDays} {rangeDays === 1 ? "day" : "days"})
            </span>
          </div>
          {loading && <span className="font-medium text-accent-strong animate-pulse">Updating metrics…</span>}
        </div>
      </Card>

      {/* KPI Headline Cards */}
      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Total Net Sales"
            value={data.totals.sales}
            hint={`${data.from} to ${data.to}`}
            subtitle="Deliveries net of returns"
            icon={<TrendingUp className="size-5" />}
            tone="primary"
            badge={{ text: "Net Sales", variant: "primary" }}
          />
          <StatTile
            label="Month-to-Date (MTD) Sales"
            value={data.totals.monthSales}
            hint={`${data.to.slice(0, 7)}-01 to ${data.to}`}
            subtitle="Current month pace"
            icon={<CalendarCheck className="size-5" />}
            tone="purple"
            badge={{ text: "MTD", variant: "neutral" }}
          />
          <StatTile
            label="Total Collection"
            value={data.totals.collection}
            hint={`${data.from} to ${data.to}`}
            subtitle={
              collectionRatio !== null
                ? `${collectionRatio}% collection of net sales`
                : "Cash & bank collected"
            }
            icon={<Wallet className="size-5" />}
            tone="success"
            badge={{
              text: collectionRatio !== null ? `${collectionRatio}% Ratio` : "Receipts",
              variant: "success",
            }}
          />
          <StatTile
            label="Customer Overdue"
            value={totalOverdue}
            hint={`As of ${data.to}`}
            subtitle={`${data.overdue.length} customer(s) • ৳ ${formatAmount(totalDueToday)} due today`}
            icon={<AlertCircle className="size-5" />}
            tone={totalOverdue > 0 ? "danger" : "success"}
            badge={{
              text: totalOverdue > 0 ? `${data.overdue.length} Overdue` : "Clean",
              variant: totalOverdue > 0 ? "danger" : "success",
            }}
          />
        </div>
      )}

      {/* Main Content Area */}
      {error ? (
        <Card className="p-4">
          <ErrorState message={errorMessage(error)} onRetry={reload} />
        </Card>
      ) : !data ? (
        <Card className="p-8">
          <LoadingState label="Loading sales dashboard metrics…" />
        </Card>
      ) : (
        <div
          className={cn("flex flex-col gap-4 transition-opacity", loading && "opacity-75")}
          aria-busy={loading}
        >
          {/* Target & Receivables Grid */}
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <TargetWidget data={data.target} />
            </div>
            <div className="lg:col-span-7">
              <OverdueWidget data={data} />
            </div>
          </div>

          {/* Top 10 Performers 3-Column Grid */}
          <div className="grid gap-4 lg:grid-cols-3">
            <RankedWidget
              title="Top 10 Selling Items"
              rows={data.topItems}
              empty="No items sold in this period."
              kind="item"
            />
            <RankedWidget
              title="Top 10 Customers"
              rows={data.topCustomers}
              empty="No customer sales in this period."
              kind="customer"
            />
            <RankedWidget
              title="Top 10 Salesforce"
              rows={data.topSalesPersons}
              empty="No sales person sales in this period."
              kind="person"
            />
          </div>
        </div>
      )}
    </div>
  );
}
