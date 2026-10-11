"use client";

import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/section";

export function ReportsView() {
  const reports = [
    {
      title: "Purchase Register Report",
      code: "PR-REG-01",
      description: "Detailed chronological log of all purchase orders, invoice values and tax amounts.",
      frequency: "Daily / Monthly",
      lastGenerated: "Today at 02:30 PM",
    },
    {
      title: "Supplier Aging & Outstanding Balance",
      code: "SUP-AGE-02",
      description: "Accounts payable aging schedule across 0-30, 31-60, 61-90 and 90+ days credit intervals.",
      frequency: "Weekly",
      lastGenerated: "Yesterday at 05:00 PM",
    },
    {
      title: "Goods Receipt & Pending Delivery Log",
      code: "GRN-PEND-03",
      description: "Reconciliation between purchase orders issued and physical warehouse goods received.",
      frequency: "Real-time",
      lastGenerated: "2 hours ago",
    },
    {
      title: "Purchase Return & Debit Note Register",
      code: "RET-DEB-04",
      description: "Summary of rejected shipments, returned stock and credited debit note balances.",
      frequency: "Monthly",
      lastGenerated: "10 Oct 2026",
    },
  ];

  return (
    <PageContainer>
      <PageHead
        title="Purchase Reports"
        subtitle="Exportable procurement registers, supplier aging schedules and audit summaries"
        actions={
          <Button variant="secondary" onClick={() => alert("Downloading all monthly registers...")}>
            <Download aria-hidden="true" />
            Export All Data
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {reports.map((report) => (
          <Card key={report.code} className="flex flex-col justify-between p-5">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="rounded bg-control px-2 py-0.5 text-xs font-semibold text-ink-muted">
                  {report.code}
                </span>
                <span className="text-xs text-ink-faint">{report.frequency}</span>
              </div>
              <h2 className="text-base font-semibold text-ink">{report.title}</h2>
              <p className="text-xs text-ink-muted leading-relaxed">{report.description}</p>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-line pt-3">
              <span className="text-[11px] text-ink-faint">Last generated: {report.lastGenerated}</span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => alert(`Exporting ${report.title} as PDF`)}
                  title="Export PDF"
                >
                  <FileText className="size-3.5" />
                  PDF
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => alert(`Exporting ${report.title} as Excel`)}
                  title="Export Excel"
                >
                  <FileSpreadsheet className="size-3.5" />
                  Excel
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
