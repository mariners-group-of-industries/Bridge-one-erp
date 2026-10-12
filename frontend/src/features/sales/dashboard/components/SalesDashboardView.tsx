"use client";

import { RefreshCw } from "lucide-react";
import { useState, type FormEvent } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form-field";
import { Card, ErrorState, LoadingState } from "@/components/ui/section";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { useToday } from "../../lib/use-today";
import { dashboardQuerySchema, type DashboardQuery } from "../schemas/dashboard.schema";
import { fetchSalesDashboard } from "../services/dashboard.api";
import { OverdueWidget, RankedWidget, StatTile, TargetWidget } from "./DashboardWidgets";

/** Sales Dashboard. Waits for the browser's date (see useToday) before loading. */
export function SalesDashboardView() {
  const today = useToday();
  return (
    <PageContainer>
      <PageHead title="Sales Dashboard" subtitle="Sales, collections, dues and top performers." />
      {today ? <Dashboard today={today} /> : <LoadingState />}
    </PageContainer>
  );
}

function Dashboard({ today }: { today: string }) {
  const [form, setForm] = useState({ from: `${today.slice(0, 7)}-01`, to: today });
  const [query, setQuery] = useState<DashboardQuery>(form);
  const [formError, setFormError] = useState<string>();
  const { data, error, loading, reload } = useResource(`${query.from}|${query.to}`, () => fetchSalesDashboard(query));

  function view(event: FormEvent) {
    event.preventDefault();
    const parsed = dashboardQuerySchema.safeParse(form);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message);
      return;
    }
    setFormError(undefined);
    if (parsed.data.from === query.from && parsed.data.to === query.to) reload();
    else setQuery(parsed.data);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <form onSubmit={view} className="flex flex-wrap items-end gap-3">
          <TextField
            label="From Date"
            type="date"
            required
            value={form.from}
            max={form.to}
            onChange={(event) => setForm({ ...form, from: event.target.value })}
            className="w-44"
          />
          <TextField
            label="To Date"
            type="date"
            required
            value={form.to}
            min={form.from}
            onChange={(event) => setForm({ ...form, to: event.target.value })}
            className="w-44"
          />
          <Button type="submit" variant="primary" disabled={loading}>
            <RefreshCw aria-hidden="true" />
            View
          </Button>
          {formError && (
            <p role="alert" className="w-full text-xs text-danger">
              {formError}
            </p>
          )}
        </form>
      </Card>

      {error ? (
        <Card>
          <ErrorState message={errorMessage(error)} onRetry={reload} />
        </Card>
      ) : !data ? (
        <Card>
          <LoadingState label="Loading dashboard…" />
        </Card>
      ) : (
        <div className={loading ? "flex flex-col gap-4 opacity-60 transition-opacity" : "flex flex-col gap-4"} aria-busy={loading}>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile label="Total Sales" value={data.totals.sales} hint={`${data.from} to ${data.to}`} />
            <StatTile label="Total Sales / This Month" value={data.totals.monthSales} hint={`${data.to.slice(0, 7)}-01 to ${data.to}`} />
            <StatTile label="Total Collection" value={data.totals.collection} hint={`${data.from} to ${data.to}`} />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <TargetWidget data={data.target} />
            <OverdueWidget data={data} className="lg:col-span-2" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <RankedWidget title="Top 10 Selling Items" rows={data.topItems} empty="No items sold in this range" />
            <RankedWidget title="Top 10 Customers" rows={data.topCustomers} empty="No customer sales in this range" />
            <RankedWidget title="Top 10 Salesforce" rows={data.topSalesPersons} empty="No sales person sales in this range" />
          </div>
        </div>
      )}
    </div>
  );
}
