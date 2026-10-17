"use client";

import { ChartNoAxesCombined, PackageCheck, RefreshCw } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/form-field";
import { Card, EmptyState, ErrorState, LoadingState } from "@/components/ui/section";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { formatAmount, formatQty } from "@/features/sales/dashboard/lib/format";
import { useToday } from "@/features/sales/lib/use-today";
import { fetchSalesLookups } from "@/features/sales/masters/services/masters.api";
import { productionDashboardQuerySchema, type ProductionDashboardQuery } from "../schemas/dashboard.schema";
import { fetchProductionDashboard } from "../services/dashboard.api";

/** Production Dashboard. Waits for the browser's date before loading. */
export function ProductionDashboardView() {
  const today = useToday();
  return (
    <PageContainer className="max-w-none">
      <PageHead title="Production Dashboard" subtitle="Output, productivity and the top items and machines." />
      {today ? <Dashboard today={today} /> : <LoadingState />}
    </PageContainer>
  );
}

function Dashboard({ today }: { today: string }) {
  const lookups = useResource("sales-lookups", fetchSalesLookups);
  const [form, setForm] = useState({ officeId: "", from: `${today.slice(0, 8)}01`, to: today });
  const [query, setQuery] = useState<ProductionDashboardQuery>({ from: form.from, to: form.to });
  const [formError, setFormError] = useState<string>();
  const dashboard = useResource(`production-dashboard:${JSON.stringify(query)}`, () => fetchProductionDashboard(query));

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
      <Card className="flex flex-col gap-4 p-4">
        <form onSubmit={view} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <SelectField
            label="Office"
            value={form.officeId}
            options={[{ value: "", label: "All" }, ...(lookups.data?.offices ?? []).map((office) => ({ value: office.id, label: office.name }))]}
            onChange={(event) => setForm({ ...form, officeId: event.target.value })}
          />
          <TextField label="From Date" type="date" required value={form.from} max={form.to} onChange={(event) => setForm({ ...form, from: event.target.value })} />
          <TextField label="To Date" type="date" required value={form.to} min={form.from} onChange={(event) => setForm({ ...form, to: event.target.value })} />
          <Button type="submit" variant="primary" disabled={dashboard.loading}>
            <RefreshCw aria-hidden="true" />
            View
          </Button>
          {formError && (
            <p role="alert" className="text-xs text-danger sm:col-span-4">
              {formError}
            </p>
          )}
        </form>
        {data && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Stat icon={<PackageCheck />} value={formatAmount(data.volume)} label="Production Volume (Unit)" hint={`${data.entries} production entries`} />
            <Stat icon={<ChartNoAxesCombined />} value={formatAmount(data.productivity)} label="Productivity (Unit per hour)" hint={`${formatQty(data.hours)} machine hours`} />
          </div>
        )}
      </Card>

      {dashboard.error ? (
        <Card>
          <ErrorState message={errorMessage(dashboard.error)} onRetry={dashboard.reload} />
        </Card>
      ) : !data ? (
        <Card>
          <LoadingState label="Loading dashboard…" />
        </Card>
      ) : (
        <div className={dashboard.loading ? "grid gap-4 opacity-60 transition-opacity lg:grid-cols-2" : "grid gap-4 lg:grid-cols-2"} aria-busy={dashboard.loading}>
          <TopList
            title="Produced Item"
            empty="Nothing produced in this range"
            rows={data.topItems.map((row) => ({ key: row.itemId, initial: row.code || row.name, title: `${row.code} - ${row.name} (${row.uom})`, value: `${formatQty(row.qty)} ${row.uom}` }))}
          />
          <TopList
            title="Machine"
            empty="No work center output in this range"
            rows={data.topWorkCenters.map((row) => ({
              key: row.workCenterId,
              initial: row.name,
              title: `${row.code} - ${row.name}`,
              value: formatQty(row.qty),
              detail: row.productivity === null ? undefined : `${formatAmount(row.productivity)} unit/hour`,
            }))}
          />
        </div>
      )}
    </div>
  );
}

function Stat({ icon, value, label, hint }: { icon: ReactNode; value: string; label: string; hint: string }) {
  return (
    <div className="flex items-center gap-3" title={hint}>
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong [&_svg]:size-5">
        {icon}
      </span>
      <span className="flex flex-col">
        <span className="text-xl font-semibold text-ink tabular-nums">{value}</span>
        <span className="text-xs text-ink-muted">{label}</span>
      </span>
    </div>
  );
}

function TopList({ title, empty, rows }: { title: string; empty: string; rows: { key: string; initial: string; title: string; value: string; detail?: string }[] }) {
  const id = `top-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <Card className="flex flex-col">
      <section aria-labelledby={id} className="flex flex-1 flex-col gap-3 p-4">
        <header>
          <h2 id={id} className="text-lg font-semibold text-ink">
            {title}
          </h2>
          <p className="text-xs text-ink-muted">Top 5</p>
        </header>
        {rows.length === 0 ? (
          <EmptyState title={empty} />
        ) : (
          <ol className="flex flex-col gap-2">
            {rows.map((row) => (
              <li key={row.key} className="flex items-center gap-3">
                <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-strong">
                  {row.initial.charAt(0).toUpperCase()}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm text-ink">{row.title}</span>
                  {row.detail && <span className="text-xs text-ink-faint">{row.detail}</span>}
                </span>
                <span className="shrink-0 text-sm font-semibold text-ink tabular-nums">{row.value}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </Card>
  );
}
