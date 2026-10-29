"use client";

import { Eye, Lock, Undo2, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { apiRequest, errorMessage } from "@/lib/api/client";
import { resolveBreadcrumbs } from "@/lib/navigation/registry";
import { EmptyBlock, TABLE } from "@/features/configuration/entity-master-data/employee/components/kit";
import { Grid } from "../../self-service/leave-movement/components/shared";
import { hrmPaths } from "../../paths";
import { FilterBar, FilterField, MonthSelect, OfficeSelect, YearSelect, currentPeriod, formatDate, formatMoney, monthLabel, useHrOptions } from "../../shared/hr-ui";
import type { PayrollRow } from "../types";

const HEADERS = ["SL", "Action", "Business Unit", "Office Name", "Payroll Month", "From Date & To Date", "Employees", "Net Amount", "Processing Status"];

export function PayrollView() {
  const toast = useToast();
  const options = useHrOptions();
  const [filter, setFilter] = useState({ officeId: "", ...currentPeriod() });
  const [applied, setApplied] = useState(filter);
  const month = `${applied.year}-${applied.month}`;
  const key = `hrm-payroll?${applied.officeId}&${month}`;
  const list = useResource(key, () => apiRequest<PayrollRow[]>(`/api/hrm/payroll?month=${month}${applied.officeId ? `&officeId=${applied.officeId}` : ""}`));
  const [confirm, setConfirm] = useState<{ row: PayrollRow; action: "process" | "undo" } | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.action === "process") await apiRequest("/api/hrm/payroll", { method: "POST", body: JSON.stringify({ officeId: confirm.row.officeId, month: confirm.row.month }) });
      else await apiRequest(`/api/hrm/payroll/${confirm.row.runId}`, { method: "DELETE" });
      toast.success(confirm.action === "process" ? "Payroll processed." : "Processing undone.");
      setConfirm(null);
      list.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const total = list.data?.reduce((sum, r) => sum + r.netAmount, 0) ?? 0;

  return (
    <PageContainer full>
      <PageHead
        title="Payroll"
        subtitle="Monthly payroll by office. Unprocessed months are calculated from current salaries; processing locks the figures."
        breadcrumbs={resolveBreadcrumbs(hrmPaths.payroll).slice(1)}
      />
      <div className="flex flex-col gap-3">
        <FilterBar onSubmit={() => setApplied(filter)} busy={list.loading}>
          <FilterField label="Office" width="w-64">
            {(id) => <OfficeSelect id={id} options={options.data} value={filter.officeId} onChange={(officeId) => setFilter((f) => ({ ...f, officeId }))} />}
          </FilterField>
          <FilterField label="Month" width="w-36">
            {(id) => <MonthSelect id={id} value={filter.month} onChange={(m) => setFilter((f) => ({ ...f, month: m }))} />}
          </FilterField>
          <FilterField label="Year" width="w-28">
            {(id) => <YearSelect id={id} value={filter.year} onChange={(year) => setFilter((f) => ({ ...f, year }))} />}
          </FilterField>
        </FilterBar>

        <section className="rounded border border-line bg-surface p-4 shadow-xs">
          {list.error ? (
            <ErrorState message={list.error.message} onRetry={list.reload} />
          ) : !list.data ? (
            <LoadingState label="Calculating payroll…" />
          ) : list.data.length === 0 ? (
            <EmptyBlock icon={<Wallet />} title="No offices to show" />
          ) : (
            <Grid headers={HEADERS} loading={list.loading}>
              {list.data.map((row, index) => (
                <tr key={row.officeId} className={TABLE.row}>
                  <td className={`${TABLE.td} text-right text-ink-faint tabular-nums`}>{index + 1}</td>
                  <td className={`${TABLE.td} px-1 py-1`}>
                    <div className="flex items-center justify-center gap-0.5">
                      <Link
                        href={`${hrmPaths.salaryDisbursement}?tab=sheet&officeId=${row.officeId}&month=${row.month}`}
                        className={buttonClasses("ghost", "icon", "hover:text-accent-strong")}
                        title="View salary sheet"
                        aria-label={`View salary sheet of ${row.officeName}`}
                      >
                        <Eye />
                      </Link>
                      {row.status === "Processed" ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:text-warning"
                          title="Undo processing"
                          aria-label={`Undo processing for ${row.officeName}`}
                          onClick={() => setConfirm({ row, action: "undo" })}
                        >
                          <Undo2 />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:text-success"
                          title="Process payroll"
                          aria-label={`Process payroll for ${row.officeName}`}
                          disabled={row.employeeCount === 0}
                          onClick={() => setConfirm({ row, action: "process" })}
                        >
                          <Lock />
                        </Button>
                      )}
                    </div>
                  </td>
                  <td className={`${TABLE.td} whitespace-nowrap`}>{row.businessUnit}</td>
                  <td className={`${TABLE.td} whitespace-nowrap`}>{row.officeName}</td>
                  <td className={`${TABLE.td} whitespace-nowrap`}>{monthLabel(row.month)}</td>
                  <td className={`${TABLE.td} whitespace-nowrap tabular-nums`}>
                    {formatDate(row.fromDate)} – {formatDate(row.toDate)}
                  </td>
                  <td className={`${TABLE.td} text-right tabular-nums`}>{row.employeeCount}</td>
                  <td className={`${TABLE.td} text-right font-semibold tabular-nums`}>{formatMoney(row.netAmount)}</td>
                  <td className={TABLE.td} title={row.processedByName ? `Processed by ${row.processedByName}` : undefined}>
                    <Badge variant={row.status === "Processed" ? "success" : "warning"}>{row.status}</Badge>
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-grid-head-rule bg-grid-head font-semibold">
                <td className={TABLE.td} colSpan={7}>
                  Total
                </td>
                <td className={`${TABLE.td} text-right tabular-nums`}>{formatMoney(total)}</td>
                <td className={TABLE.td} />
              </tr>
            </Grid>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.action === "process" ? "Process payroll" : "Undo processing"}
        message={
          confirm &&
          (confirm.action === "process"
            ? `Lock ${confirm.row.officeName}'s payroll for ${monthLabel(confirm.row.month)} at ${formatMoney(confirm.row.netAmount)}? Later salary changes will not alter it.`
            : `Undo processing of ${confirm.row.officeName} for ${monthLabel(confirm.row.month)}? The month will be calculated from current salaries again.`)
        }
        confirmLabel={confirm?.action === "process" ? "Process" : "Undo"}
        busy={busy}
        onConfirm={() => void run()}
        onClose={() => setConfirm(null)}
      />
    </PageContainer>
  );
}
