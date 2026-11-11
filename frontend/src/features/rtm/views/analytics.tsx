"use client";

import { useState } from "react";
import { Card, ErrorState, LoadingState } from "@/components/ui/section";
import { useResource } from "@/hooks/use-resource";
import { salesAnalytics } from "../navigation";
import { money, monthStart, qty, rtmApi, today } from "../services/rtm.api";
import { DateRange, FilterBar, Kpi, RtmPage, SimpleTable } from "../components/kit";

interface AnalyticsGroup {
  name: string;
  sales: number;
  deliveries: number;
}

interface ItemGroup {
  name: string;
  uom: string;
  qty: number;
  sales: number;
}

interface SalesAnalyticsData {
  total: number;
  deliveries: number;
  outlets: number;
  monthly: AnalyticsGroup[];
  byChannel: AnalyticsGroup[];
  byRoute: AnalyticsGroup[];
  byDistributor: AnalyticsGroup[];
  bySr: AnalyticsGroup[];
  byItem: ItemGroup[];
}

const groupColumns = [
  { header: "Name", cell: (r: AnalyticsGroup) => r.name },
  { header: "Deliveries", cell: (r: AnalyticsGroup) => r.deliveries.toLocaleString(), align: "right" as const },
  { header: "Sales", cell: (r: AnalyticsGroup) => money(r.sales), align: "right" as const },
];

export function SalesAnalyticsView() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const data = useResource(`rtm-analytics-${from}-${to}`, () =>
    rtmApi.get<SalesAnalyticsData>("sales-analytics", { from, to }),
  );

  return (
    <RtmPage page={salesAnalytics}>
      <FilterBar>
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      </FilterBar>

      {data.error ? (
        <ErrorState message={data.error.message} onRetry={data.reload} />
      ) : !data.data ? (
        <LoadingState />
      ) : (
        <AnalyticsContent d={data.data} />
      )}
    </RtmPage>
  );
}

function AnalyticsContent({ d }: { d: SalesAnalyticsData }) {
  return (
    <>
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Kpi label="Total sales" value={money(d.total)} tone="success" />
        <Kpi label="Deliveries" value={d.deliveries.toLocaleString()} />
        <Kpi label="Outlets served" value={d.outlets.toLocaleString()} />
      </div>

      {/* Monthly trend */}
      <SimpleTable
        title="Monthly trend"
        rows={d.monthly}
        empty="No data."
        columns={[
          { header: "Month", cell: (r) => r.name },
          { header: "Deliveries", cell: (r) => r.deliveries.toLocaleString(), align: "right" },
          { header: "Sales", cell: (r) => money(r.sales), align: "right" },
        ]}
      />

      {/* Channel + Route side by side */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SimpleTable title="Sales by channel" rows={d.byChannel} empty="No data." columns={groupColumns} />
        <SimpleTable title="Sales by route" rows={d.byRoute} empty="No data." columns={groupColumns} />
      </div>

      {/* Distributor + SR side by side */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SimpleTable title="Sales by distributor" rows={d.byDistributor} empty="No data." columns={groupColumns} />
        <SimpleTable title="Sales by sales representative" rows={d.bySr} empty="No data." columns={groupColumns} />
      </div>

      {/* Item breakdown */}
      <Card>
        <div className="flex flex-col gap-2 p-4">
          <h2 className="text-sm font-bold text-ink">Sales by item</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-ink-muted">
                <tr>
                  <th className="py-1.5 pr-3 text-left font-semibold">Item</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">UoM</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Qty sold</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Sales</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">% of total</th>
                </tr>
              </thead>
              <tbody>
                {d.byItem.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-sm text-ink-faint">
                      No items sold in this period.
                    </td>
                  </tr>
                ) : (
                  d.byItem.map((item) => (
                    <tr key={item.name} className="border-t border-line">
                      <td className="py-1.5 pr-3">{item.name}</td>
                      <td className="py-1.5 pr-3 text-right text-ink-muted">{item.uom}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{qty(item.qty)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{money(item.sales)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-ink-muted">
                        {d.total > 0 ? `${((item.sales / d.total) * 100).toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {d.byItem.length > 0 && (
                <tfoot className="border-t border-line">
                  <tr className="font-semibold text-ink">
                    <td className="py-1.5 pr-3">Total</td>
                    <td />
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {qty(d.byItem.reduce((t, i) => t + i.qty, 0))}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{money(d.total)}</td>
                    <td className="py-1.5 pr-3 text-right">100%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </Card>
    </>
  );
}
