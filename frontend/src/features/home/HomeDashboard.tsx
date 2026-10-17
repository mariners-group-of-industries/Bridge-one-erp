"use client";

import { Boxes, Building2, Target, Truck, Users, UserSquare2, Wallet, Warehouse, Tags } from "lucide-react";
import type { ReactNode } from "react";
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ErrorState } from "@/components/ui/section";
import { useResource } from "@/hooks/use-resource";
import { apiRequest } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { BusinessOverview, Named } from "./overview.types";

// Theme tokens, so charts follow light/dark mode.
const C = {
  accent: "var(--color-accent-strong)",
  accentSoft: "var(--color-accent)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
  muted: "var(--color-ink-faint)",
  grid: "var(--color-line)",
  ink: "var(--color-ink-muted)",
};
const PALETTE = [C.accent, C.success, C.warning, C.accentSoft, C.danger, C.muted, "var(--color-line-strong)", "var(--color-ink)"];

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const money = (value: number) => `৳${compact.format(value)}`;
const moneyFull = (value: number) => `৳${whole.format(value)}`;
const units = (value: number) => compact.format(value);
const shortDate = (period: string) =>
  period.length === 7
    ? new Date(`${period}-01T00:00:00Z`).toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" })
    : new Date(`${period}T00:00:00Z`).toLocaleString("en-US", { day: "numeric", month: "short", timeZone: "UTC" });
const monthName = (month: string) => new Date(`${month}-01T00:00:00Z`).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const shorten = (name: string, max = 26) => (name.length > max ? `${name.slice(0, max - 1)}…` : name);
const axis = { tick: { fill: C.ink, fontSize: 11 }, axisLine: false, tickLine: false } as const;

export function HomeDashboard() {
  const overview = useResource("home-overview", () => apiRequest<BusinessOverview>("/api/home/overview"));
  if (overview.error) return <ErrorState message={overview.error.message} onRetry={overview.reload} />;
  if (!overview.data) return <DashboardSkeleton />;
  const d = overview.data;
  const inv = d.inventory;

  const dispatched = inv.movement.reduce((s, p) => s + p.outQty, 0);
  const returned = inv.movement.reduce((s, p) => s + p.returnQty, 0);
  const margins = inv.byItem
    .filter((i) => i.mrp && i.mrp > 0)
    .map((i) => ({ name: i.name, margin: Math.round(((i.mrp! - i.salesRate) / i.mrp!) * 1000) / 10, salesRate: i.salesRate, mrp: i.mrp! }))
    .sort((a, b) => b.margin - a.margin);
  const avgMargin = margins.length ? margins.reduce((s, m) => s + m.margin, 0) / margins.length : 0;
  const budget = d.finance?.budget ?? null;
  const budgetUse = budget && budget.allocated ? Math.round(((budget.utilized + budget.committed) / budget.allocated) * 100) : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Headline figures */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={<Wallet />} label="Inventory value (at sales rate)" value={money(inv.value)} title={moneyFull(inv.value)} note={`${units(inv.units)} units across ${inv.byItem.length} items`} />
        <Kpi
          icon={<Truck />}
          label="Units dispatched"
          value={units(dispatched)}
          note={inv.movement.length ? `${whole.format(returned)} returned · ${dispatched ? ((returned / dispatched) * 100).toFixed(1) : "0.0"}% return rate` : "No stock movements yet"}
        />
        <Kpi
          icon={<Target />}
          label={d.targets.month ? `Sales target · ${monthName(d.targets.month)}` : "Sales target"}
          value={d.targets.month ? money(d.targets.total) : "—"}
          title={moneyFull(d.targets.total)}
          note={d.targets.month ? `${d.targets.byPerson.length} sales people · avg ${money(d.targets.total / Math.max(1, d.targets.byPerson.length))}` : "No targets set"}
        />
        {budget ? (
          <Kpi
            icon={<Building2 />}
            label="Budget used (utilised + committed)"
            value={`${budgetUse}%`}
            note={`${money(budget.utilized + budget.committed)} of ${money(budget.allocated)} · ${money(budget.remaining)} left`}
            tone={budgetUse! > 90 ? "danger" : budgetUse! > 70 ? "warning" : "success"}
          />
        ) : (
          <Kpi icon={<Tags />} label="Average retail margin" value={`${avgMargin.toFixed(1)}%`} note="(MRP − sales rate) ÷ MRP, per item" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Count icon={<Users />} label="Customers" value={d.counts.customers} />
        <Count icon={<Truck />} label="Suppliers" value={d.counts.suppliers} />
        <Count icon={<Boxes />} label="Items" value={d.counts.items} />
        <Count icon={<UserSquare2 />} label="Employees" value={d.counts.employees} />
        <Count icon={<Warehouse />} label="Warehouses" value={d.counts.warehouses} />
        <Count icon={<Tags />} label="Price lists" value={d.counts.priceLists} />
      </div>

      {d.trading && (
        <Card title="Sales, collections & purchases" subtitle="Submitted documents, last 12 months">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={d.trading.map((m) => ({ ...m, label: shortDate(m.month) }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" {...axis} />
              <YAxis tickFormatter={money} {...axis} width={56} />
              <Tooltip content={<ValueTooltip format={moneyFull} />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="sales" name="Sales" stroke={C.accent} fill={C.accent} fillOpacity={0.12} strokeWidth={2} />
              <Bar dataKey="collections" name="Collections" fill={C.success} radius={[3, 3, 0, 0]} barSize={12} />
              <Bar dataKey="purchases" name="Purchases" fill={C.warning} radius={[3, 3, 0, 0]} barSize={12} />
              <Line type="monotone" dataKey="returns" name="Returns" stroke={C.danger} dot={false} strokeDasharray="4 3" />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Inventory */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Stock movement" subtitle="Units in and out per day, with stock on hand" empty={!inv.movement.length && "No stock movements recorded yet."}>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={inv.movement.map((p) => ({ ...p, label: shortDate(p.period), receivedQty: p.inQty - p.returnQty }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" {...axis} />
              <YAxis yAxisId="flow" tickFormatter={units} {...axis} width={44} />
              <YAxis yAxisId="balance" orientation="right" tickFormatter={units} {...axis} width={44} />
              <Tooltip content={<ValueTooltip format={(v) => `${whole.format(v)} units`} />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="flow" dataKey="outQty" name="Dispatched" fill={C.accent} radius={[3, 3, 0, 0]} barSize={14} />
              <Bar yAxisId="flow" dataKey="returnQty" name="Returned" fill={C.danger} radius={[3, 3, 0, 0]} barSize={14} />
              <Line yAxisId="balance" type="stepAfter" dataKey="balance" name="On hand" stroke={C.success} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Inventory value by category" subtitle="Stock on hand × sales rate" empty={!inv.byCategory.length && "No stock on hand."}>
          <Donut rows={inv.byCategory} format={money} centerLabel="total value" centerValue={money(inv.value)} />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Stock value by item" subtitle="Units on hand and their value at sales rate" empty={!inv.byItem.length && "No stock on hand."}>
          <ResponsiveContainer width="100%" height={Math.max(200, inv.byItem.length * 30)}>
            <BarChart data={inv.byItem.map((i) => ({ ...i, label: shorten(i.name) }))} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={money} {...axis} />
              <YAxis type="category" dataKey="label" width={170} {...axis} />
              <Tooltip content={<ItemTooltip />} />
              <Bar dataKey="value" name="Value" fill={C.accent} radius={[0, 3, 3, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Retail margin by item" subtitle="(MRP − sales rate) ÷ MRP" empty={!margins.length && "No items with an MRP."}>
          <ResponsiveContainer width="100%" height={Math.max(200, margins.length * 30)}>
            <BarChart data={margins.map((m) => ({ ...m, label: shorten(m.name) }))} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => `${v}%`} {...axis} />
              <YAxis type="category" dataKey="label" width={170} {...axis} />
              <Tooltip content={<MarginTooltip />} />
              <Bar dataKey="margin" name="Margin" radius={[0, 3, 3, 0]} barSize={14}>
                {margins.map((m) => (
                  <Cell key={m.name} fill={m.margin >= avgMargin ? C.success : C.warning} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Sales force & market */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="Sales target by sales person"
          subtitle={d.targets.month ? monthName(d.targets.month) : undefined}
          empty={!d.targets.byPerson.length && "No sales targets set yet."}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={d.targets.byPerson.map((p) => ({ ...p, label: p.name.replace(/^(Md|Mst)\.\s*/i, "") }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" {...axis} interval={0} angle={-25} textAnchor="end" height={56} />
              <YAxis tickFormatter={money} {...axis} width={52} />
              <Tooltip content={<ValueTooltip format={moneyFull} />} />
              <Bar dataKey="value" name="Target" radius={[3, 3, 0, 0]} barSize={22}>
                {d.targets.byPerson.map((p) => (
                  <Cell key={p.name} fill={p.value >= d.targets.total / Math.max(1, d.targets.byPerson.length) ? C.accent : C.accentSoft} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Customers by region" subtitle="Customer group" empty={!d.customers.byGroup.length && "No customers yet."}>
          <Donut rows={d.customers.byGroup} format={(v) => `${v}`} centerLabel="customers" centerValue={String(d.counts.customers)} />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Customers by territory" empty={!d.customers.byTerritory.length && "No customers yet."}>
          <RankList rows={d.customers.byTerritory} format={(v) => `${v}`} color={C.accent} />
        </Card>
        <Card title="Price lists" subtitle="Average rate across items" empty={!d.priceLists.length && "No price lists yet."}>
          <ResponsiveContainer width="100%" height={Math.max(200, d.priceLists.length * 26)}>
            <BarChart data={d.priceLists} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => `৳${v}`} {...axis} domain={["dataMin - 2", "dataMax + 1"]} />
              <YAxis type="category" dataKey="name" width={120} {...axis} />
              <Tooltip content={<ValueTooltip format={(v) => `৳${v.toFixed(2)}`} />} />
              <Bar dataKey="value" name="Average rate" fill={C.success} radius={[0, 3, 3, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Workforce" subtitle="Active employees" empty={!d.counts.employees && "No employees yet."}>
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-[11px] font-semibold tracking-wider text-ink-faint uppercase">By office</p>
              <RankList rows={d.employees.byOffice} format={(v) => `${v}`} color={C.success} />
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold tracking-wider text-ink-faint uppercase">By designation</p>
              <RankList rows={d.employees.byDesignation} format={(v) => `${v}`} color={C.warning} />
            </div>
          </div>
        </Card>
      </div>

      {/* Finance */}
      {d.finance && (
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2" title="Account balances by type" subtitle="Current balance, chart of accounts" empty={!d.finance.balances.length && "No accounts yet."}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={d.finance.balances} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" {...axis} />
                <YAxis tickFormatter={money} {...axis} width={56} />
                <Tooltip content={<ValueTooltip format={moneyFull} />} />
                <Bar dataKey="value" name="Balance" radius={[3, 3, 0, 0]} barSize={40}>
                  {d.finance.balances.map((b, i) => (
                    <Cell key={b.name} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card title="Budget utilisation" subtitle={budget ? `${budget.count} budget(s)` : undefined} empty={!budget && "No budgets yet."}>
            {budget && (
              <div className="flex flex-col gap-3">
                <div
                  className="flex h-4 overflow-hidden rounded-full bg-control"
                  role="img"
                  aria-label={`Utilised ${money(budget.utilized)}, committed ${money(budget.committed)}, remaining ${money(budget.remaining)}`}
                >
                  <div style={{ width: `${(budget.utilized / budget.allocated) * 100}%`, background: C.accent }} />
                  <div style={{ width: `${(budget.committed / budget.allocated) * 100}%`, background: C.warning }} />
                </div>
                <dl className="grid grid-cols-2 gap-3">
                  <Legendary color={C.accent} label="Utilised" value={money(budget.utilized)} />
                  <Legendary color={C.warning} label="Committed" value={money(budget.committed)} />
                  <Legendary color={C.grid} label="Remaining" value={money(budget.remaining)} />
                  <Legendary color={C.ink} label="Allocated" value={money(budget.allocated)} />
                </dl>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

function Card({ title, subtitle, className, empty, children }: { title: string; subtitle?: string; className?: string; empty?: string | false; children: ReactNode }) {
  return (
    <section aria-label={title} className={cn("flex flex-col gap-3 rounded border border-line bg-surface p-4 shadow-xs", className)}>
      <header>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {subtitle && <p className="text-xs text-ink-faint">{subtitle}</p>}
      </header>
      {empty ? <p className="py-10 text-center text-sm text-ink-faint">{empty}</p> : children}
    </section>
  );
}

function Kpi({ icon, label, value, note, title, tone }: { icon: ReactNode; label: string; value: string; note: string; title?: string; tone?: "success" | "warning" | "danger" }) {
  return (
    <section aria-label={label} className="flex flex-col gap-1.5 rounded border border-line bg-surface p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-ink-faint">{label}</span>
        <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-md bg-accent-soft text-accent-strong dark:text-accent [&_svg]:size-4">
          {icon}
        </span>
      </div>
      <p className={cn("text-2xl font-bold tabular-nums", tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-ink")} title={title}>
        {value}
      </p>
      <p className="text-xs text-ink-faint">{note}</p>
    </section>
  );
}

function Count({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded border border-line bg-surface px-3 py-2.5 shadow-xs">
      <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-md bg-control text-ink-muted [&_svg]:size-4">
        {icon}
      </span>
      <div>
        <p className="text-lg leading-tight font-bold text-ink tabular-nums">{whole.format(value)}</p>
        <p className="text-[11px] text-ink-faint">{label}</p>
      </div>
    </div>
  );
}

function Donut({ rows, format, centerLabel, centerValue }: { rows: Named[]; format: (v: number) => string; centerLabel: string; centerValue: string }) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <div className="flex flex-col gap-3">
      <div className="relative h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius={56} outerRadius={82} paddingAngle={2} stroke="none">
              {rows.map((r, i) => (
                <Cell key={r.name} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip content={<ValueTooltip format={format} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-ink tabular-nums">{centerValue}</span>
          <span className="text-[11px] text-ink-faint">{centerLabel}</span>
        </div>
      </div>
      <ul className="flex flex-col gap-1.5 text-xs">
        {rows.map((r, i) => (
          <li key={r.name} className="flex items-center gap-2">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="flex-1 truncate text-ink-muted">{r.name}</span>
            <span className="font-semibold text-ink tabular-nums">{format(r.value)}</span>
            <span className="w-10 text-right text-ink-faint tabular-nums">{total ? Math.round((r.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RankList({ rows, format, color }: { rows: Named[]; format: (v: number) => string; color: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ol className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.name} className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-ink">{r.name}</span>
            <span className="font-semibold text-ink tabular-nums">{format(r.value)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-control">
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function Legendary({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span aria-hidden="true" className="mt-1 size-2 shrink-0 rounded-full" style={{ background: color }} />
      <div>
        <dt className="text-[11px] text-ink-faint">{label}</dt>
        <dd className="text-sm font-semibold text-ink tabular-nums">{value}</dd>
      </div>
    </div>
  );
}

type TipPayload = { name?: string; value?: number; color?: string; payload?: Record<string, unknown> }[];

function TipBox({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <div className="max-w-64 rounded border border-line bg-surface px-3 py-2 text-xs shadow-dropdown">
      {title && <p className="mb-1 font-semibold text-ink">{title}</p>}
      {children}
    </div>
  );
}

function ValueTooltip({ active, payload, label, format }: { active?: boolean; payload?: TipPayload; label?: string; format: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <TipBox title={label ?? String(payload[0].payload?.name ?? "")}>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-ink-muted">
          <span aria-hidden="true" className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="flex-1">{p.name}</span>
          <span className="font-semibold text-ink tabular-nums">{format(Number(p.value ?? 0))}</span>
        </p>
      ))}
    </TipBox>
  );
}

function ItemTooltip({ active, payload }: { active?: boolean; payload?: TipPayload }) {
  const row = payload?.[0]?.payload as { name: string; qty: number; value: number; salesRate: number } | undefined;
  if (!active || !row) return null;
  return (
    <TipBox title={row.name}>
      <p className="text-ink-muted">
        {whole.format(row.qty)} units × ৳{row.salesRate} = <span className="font-semibold text-ink">{moneyFull(row.value)}</span>
      </p>
    </TipBox>
  );
}

function MarginTooltip({ active, payload }: { active?: boolean; payload?: TipPayload }) {
  const row = payload?.[0]?.payload as { name: string; margin: number; salesRate: number; mrp: number } | undefined;
  if (!active || !row) return null;
  return (
    <TipBox title={row.name}>
      <p className="text-ink-muted">
        Sales rate ৳{row.salesRate} · MRP ৳{row.mrp} → <span className="font-semibold text-ink">{row.margin}%</span>
      </p>
    </TipBox>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading business overview">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded border border-line bg-control/60" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="h-80 animate-pulse rounded border border-line bg-control/60 xl:col-span-2" />
        <div className="h-80 animate-pulse rounded border border-line bg-control/60" />
      </div>
    </div>
  );
}
