"use client";

import { TrendingUp, ShoppingBag, Truck, DollarSign } from "lucide-react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Card, Section } from "@/components/ui/section";

export function AnalyticsView() {
  const kpis = [
    {
      title: "Total Procurement YTD",
      value: "৳ 4,680,000",
      change: "+12.4% vs last month",
      icon: DollarSign,
      positive: true,
    },
    {
      title: "Active Purchase Orders",
      value: "18 Orders",
      change: "4 pending delivery",
      icon: ShoppingBag,
      positive: true,
    },
    {
      title: "On-Time Delivery Rate",
      value: "94.2%",
      change: "+3.1% improved",
      icon: Truck,
      positive: true,
    },
    {
      title: "Negotiated Cost Savings",
      value: "৳ 320,000",
      change: "Average 6.8% savings",
      icon: TrendingUp,
      positive: true,
    },
  ];

  const vendorSpend = [
    { vendor: "Apex Steel & Alloys Ltd.", category: "Raw Materials", orders: 12, spend: "৳ 1,890,000", share: "40.4%" },
    { vendor: "BSRM Steels Ltd.", category: "Structural Metal", orders: 8, spend: "৳ 1,450,000", share: "31.0%" },
    { vendor: "Rahimafrooz Industrial Energy", category: "Power & Backup", orders: 6, spend: "৳ 787,500", share: "16.8%" },
    { vendor: "Square Electronics Ltd.", category: "Electrical Components", orders: 9, spend: "৳ 552,500", share: "11.8%" },
  ];

  return (
    <PageContainer>
      <PageHead
        title="Purchase Analytics"
        subtitle="Key procurement performance indicators, spend distribution and vendor ratings"
      />

      <div className="flex flex-col gap-6">
        {/* KPI Cards Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.title}
                className="flex flex-col justify-between rounded-xl border border-line bg-surface p-5 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-ink-muted">{kpi.title}</span>
                  <span className="flex size-8 items-center justify-center rounded-lg bg-control text-ink">
                    <Icon className="size-4" />
                  </span>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-bold tracking-tight text-ink">{kpi.value}</span>
                  <p className="mt-1 text-xs text-success">{kpi.change}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Vendor Breakdown Table */}
        <Card>
          <Section
            title="Top Suppliers by Spend Volume"
            description="Cumulative spend across active vendor agreements this fiscal year"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs font-semibold text-ink-faint">
                    <th className="pb-3">Supplier Name</th>
                    <th className="pb-3">Category</th>
                    <th className="pb-3 text-center">Orders</th>
                    <th className="pb-3 text-right">Total Spend (৳)</th>
                    <th className="pb-3 text-right">Spend Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {vendorSpend.map((row) => (
                    <tr key={row.vendor} className="hover:bg-control/50 transition">
                      <td className="py-3 font-medium text-ink">{row.vendor}</td>
                      <td className="py-3 text-ink-muted">{row.category}</td>
                      <td className="py-3 text-center text-ink">{row.orders}</td>
                      <td className="py-3 text-right font-semibold text-ink tabular-nums">{row.spend}</td>
                      <td className="py-3 text-right text-ink-muted tabular-nums">{row.share}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </Card>
      </div>
    </PageContainer>
  );
}
