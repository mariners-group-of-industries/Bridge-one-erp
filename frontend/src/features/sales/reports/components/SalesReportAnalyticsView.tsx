"use client";

import { Download, Printer } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Card, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import { exportTable, type ExportTable } from "../../lib/export-table";
import { useToday } from "../../lib/use-today";
import { SalesAnalyticsPanel } from "./SalesAnalyticsView";
import { SalesReportPanel } from "./SalesReportView";

type Tab = "report" | "analytics";
const TABS: { id: Tab; label: string }[] = [
  { id: "report", label: "Sales Report" },
  { id: "analytics", label: "Sales Analytics" },
];
const isTab = (value: string | null): value is Tab => TABS.some((tab) => tab.id === value);

/** Sales Report & Analytics: every sales report and analytics view on one page (?tab=report|analytics). */
export function SalesReportAnalyticsView() {
  const today = useToday();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const tab: Tab = isTab(params.get("tab")) ? (params.get("tab") as Tab) : "report";
  const [table, setTable] = useState<ExportTable | null>(null);
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);

  async function download(format: "xlsx" | "pdf") {
    if (!table) return;
    setExporting(format);
    try {
      await exportTable(format, table.title, table.headers, table.rows);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setExporting(null);
    }
  }

  return (
    <PageContainer className="max-w-none">
      <PageHead
        title="Sales Report & Analytics"
        actions={
          <>
            <Button variant="primary" onClick={() => download("xlsx")} loading={exporting === "xlsx"} disabled={!table || exporting !== null}>
              <Download aria-hidden="true" />
              Excel
            </Button>
            <Button variant="primary" onClick={() => download("pdf")} loading={exporting === "pdf"} disabled={!table || exporting !== null}>
              <Printer aria-hidden="true" />
              PDF
            </Button>
          </>
        }
      />
      <Card>
        <Tabs<Tab> label="Sales report and analytics" tabs={TABS} value={tab} onChange={(next) => router.replace(`${pathname}?tab=${next}`)}>
          {!today ? (
            <LoadingState />
          ) : tab === "report" ? (
            <SalesReportPanel key="report" today={today} onExport={setTable} />
          ) : (
            <SalesAnalyticsPanel key="analytics" today={today} onExport={setTable} />
          )}
        </Tabs>
      </Card>
    </PageContainer>
  );
}
