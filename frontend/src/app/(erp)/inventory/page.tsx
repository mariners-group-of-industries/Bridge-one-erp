"use client";

import { useState, type ReactNode } from "react";
import { ArrowLeftRight, CalendarClock, ChartPie, Package, PackageOpen, PiggyBank, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Spinner } from "@/components/ui/spinner";
import { useResource } from "@/hooks/use-resource";
import { inventoryApi, monthAgo, today } from "@/features/inventory/services/inventory.api";

// iBOS Inventory Dashboard: period filter, four balance tiles, then Valuation, Transaction Value and Coverage Days.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** Valuation slice colours, in order of value. */
const TYPE_COLORS = ["#8b5cf6", "#f59e0b", "#14b8a6", "#3b82f6", "#ef4444", "#64748b", "#22c55e", "#ec4899"];

const taka = (v: number) => `৳ ${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pad = (n: number) => String(n).padStart(2, "0");

const field = "h-8 rounded border border-line bg-surface px-2.5 text-xs text-ink focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export default function InventoryDashboardPage() {
  const [fromDate, setFromDate] = useState(monthAgo());
  const [toDate, setToDate] = useState(today());
  const [period, setPeriod] = useState({ from: fromDate, to: toDate });
  const overview = useResource(`inventory-overview-${period.from}-${period.to}`, () => inventoryApi.overview(period));
  const data = overview.data;
  const kpis = data?.kpis ?? { totalBalance: 0, openingBalance: 0, inventoryOut: 0, inventoryIn: 0 };

  // Valuation: closing stock by item type at the end of the chosen month (iBOS Year + Month).
  const thisYear = Number(today().slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const [month, setMonth] = useState(Number(today().slice(5, 7)) - 1);
  const monthStart = `${year}-${pad(month + 1)}-01`;
  const monthEnd = (() => {
    const last = `${year}-${pad(month + 1)}-${pad(new Date(year, month + 1, 0).getDate())}`;
    return last > today() ? today() : last;
  })();
  const futureMonth = monthStart > today();
  const valuation = useResource(futureMonth ? null : `inventory-valuation-${monthStart}-${monthEnd}`, () => inventoryApi.overview({ from: monthStart, to: monthEnd }));
  const types = valuation.data?.valuationByType ?? [];
  const totalValuation = valuation.data?.totalValuation ?? 0;

  // Coverage Days for one item category (iBOS "Item Category" on the card).
  const [category, setCategory] = useState("");
  const coverageSource = useResource(category ? `inventory-coverage-${period.from}-${period.to}-${category}` : null, () => inventoryApi.overview({ ...period, category }));
  const coverage = (category ? coverageSource.data : data)?.coverage ?? [];
  const coverageLoading = category ? coverageSource.loading : overview.loading;

  const transactions = data?.topTransactions ?? [];
  const maxAmount = Math.max(1, ...transactions.map((t) => Math.abs(t.amount)));
  const years = Array.from({ length: 5 }, (_, i) => thisYear - i);

  return (
    <div className="space-y-4 p-1 text-ink sm:p-2">
      {/* Period */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-2xs">
        <label className="flex flex-col gap-1 text-xs font-medium">
          From Date
          <input type="date" value={fromDate} max={toDate} onChange={(e) => setFromDate(e.target.value)} className={`${field} w-44`} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          To Date
          <input type="date" value={toDate} min={fromDate} onChange={(e) => setToDate(e.target.value)} className={`${field} w-44`} />
        </label>
        <button
          type="button"
          onClick={() => setPeriod({ from: fromDate, to: toDate })}
          disabled={!fromDate || !toDate || fromDate > toDate || overview.loading}
          className="inline-flex h-8 min-w-16 items-center justify-center gap-2 rounded bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
        >
          {overview.loading && <Spinner className="size-3.5" />} View
        </button>
      </div>
      {overview.error && <p className="rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">{overview.error.message}</p>}

      {/* Balance tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile color="bg-blue-500" icon={<Wallet />} value={kpis.totalBalance} label="Total Balance" loading={overview.loading} />
        <Tile color="bg-amber-500" icon={<PiggyBank />} value={kpis.openingBalance} label="Opening Balance" loading={overview.loading} />
        <Tile color="bg-rose-500" icon={<PackageOpen />} value={kpis.inventoryOut} label="Inventory Out" loading={overview.loading} />
        <Tile color="bg-emerald-500" icon={<Package />} value={kpis.inventoryIn} label="Inventory In" loading={overview.loading} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Valuation */}
        <Card
          icon={<ChartPie />}
          title="Valuation"
          actions={
            <div className="flex gap-2">
              <select aria-label="Year" value={year} onChange={(e) => setYear(Number(e.target.value))} className={`${field} w-20`}>
                {years.map((y) => <option key={y}>{y}</option>)}
              </select>
              <select aria-label="Month" value={month} onChange={(e) => setMonth(Number(e.target.value))} className={`${field} w-28`}>
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
            </div>
          }
        >
          {valuation.loading ? (
            <Loading />
          ) : !types.length ? (
            <NoData />
          ) : (
            <>
              <div className="relative h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={types} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="92%" paddingAngle={1} stroke="none" isAnimationActive={false}>
                      {types.map((t, i) => <Cell key={t.name} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => taka(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-sm text-ink-muted">Total Valuation</span>
                  <span className="text-lg font-bold tabular-nums">{taka(totalValuation)}</span>
                </div>
              </div>
              <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                {types.map((t, i) => (
                  <li key={t.name} className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full" style={{ background: TYPE_COLORS[i % TYPE_COLORS.length] }} />
                    {t.name} <span className="tabular-nums">{totalValuation ? `${((t.value / totalValuation) * 100).toFixed(1)}%` : ""}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        {/* Transaction Value */}
        <Card icon={<ArrowLeftRight />} title="Transaction Value" subtitle="Top 05">
          {overview.loading ? (
            <Loading />
          ) : !transactions.length ? (
            <NoData />
          ) : (
            <ol className="space-y-4">
              {transactions.map((t, i) => (
                <li key={t.name} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2 text-[13px]">
                      <span className="truncate">{t.name}</span>
                      <span className="whitespace-nowrap font-semibold tabular-nums">{taka(t.amount)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-control">
                      <div className="h-1.5 rounded-full bg-blue-400" style={{ width: `${Math.max(2, (Math.abs(t.amount) / maxAmount) * 100)}%` }} />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>

        {/* Coverage Days */}
        <Card
          icon={<CalendarClock />}
          title="Coverage Days"
          subtitle="Daily"
          actions={
            <select aria-label="Item Category" value={category} onChange={(e) => setCategory(e.target.value)} className={`${field} w-40`}>
              <option value="">Item Category</option>
              {(data?.categories ?? []).map((c) => <option key={c}>{c}</option>)}
            </select>
          }
        >
          {coverageLoading ? (
            <Loading />
          ) : !coverage.length ? (
            <NoData />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={coverage} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--ink-muted)" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--ink-muted)" }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v) => [`${v} Days`, "Coverage"]} />
                  <Bar dataKey="days" fill="#3b82f6" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/** iBOS balance tile: solid colour, white round icon, amount and label. */
function Tile({ color, icon, value, label, loading }: { color: string; icon: ReactNode; value: number; label: string; loading: boolean }) {
  return (
    <div className={`relative flex items-center gap-4 overflow-hidden rounded-xl px-5 py-6 text-white shadow-xs ${color}`}>
      <span aria-hidden className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-white/15" />
      <span aria-hidden className="pointer-events-none absolute -bottom-12 right-14 size-24 rounded-full bg-white/10" />
      <span className="relative flex size-14 shrink-0 items-center justify-center rounded-full bg-surface text-ink [&_svg]:size-6">{icon}</span>
      <div className="relative min-w-0">
        <p className="truncate text-xl font-bold tabular-nums">{loading ? "…" : taka(value)}</p>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/90">{label}</p>
      </div>
    </div>
  );
}

/** iBOS dashboard card: a blue icon tile, title (and subtitle), controls on the right. */
function Card({ icon, title, subtitle, actions, children }: { icon: ReactNode; title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col rounded-xl border border-line border-t-4 border-t-blue-300 bg-surface p-5 shadow-2xs dark:border-t-blue-500/50">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300 [&_svg]:size-5">{icon}</span>
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {subtitle && <p className="text-xs text-ink-muted">{subtitle}</p>}
          </div>
        </div>
        {actions}
      </header>
      <div className="flex-1">{children}</div>
    </section>
  );
}

const Loading = () => (
  <div className="flex h-56 items-center justify-center">
    <Spinner label="Loading…" />
  </div>
);

const NoData = () => (
  <div className="flex h-56 flex-col items-center justify-center gap-1 text-center">
    <p className="text-sm font-semibold text-ink-muted">No Data Found</p>
  </div>
);
