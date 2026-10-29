"use client";

import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/form-field";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/section";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { useFilterLookups } from "../../deliveries/components/DeliveryWorkspaceView";
import type { ExportTable } from "../../lib/export-table";
import { formatDay } from "../../lib/use-today";
import { ANALYTICS, AREA_FILTER_LABELS, reportQuerySchema, type ReportKey, type ReportQuery } from "../schemas/report.schema";
import { fetchReport } from "../services/report.api";
import { ReportTable, reportExport, useReportExport } from "./ReportTable";

/** Sales Analytics tab: report type, office, dates and the sales area. */
export function SalesAnalyticsPanel({ today, onExport }: { today: string; onExport: (table: ExportTable | null) => void }) {
  const { offices, groups, areaOptions, lookups } = useFilterLookups();
  const [filters, setFilters] = useState({ report: "", officeId: "", from: `${today.slice(0, 8)}01`, to: today, zoneId: "", customerGroupId: "", territoryId: "", routeId: "" });
  const [query, setQuery] = useState<ReportQuery | null>(null);
  const [open, setOpen] = useState(true);
  const [filterError, setFilterError] = useState<string>();
  const result = useResource(query ? `analytics:${JSON.stringify(query)}` : null, () => fetchReport(query!), { refreshOnFocus: true });
  const field = (key: keyof typeof filters) => ({
    value: filters[key],
    onChange: (event: { target: { value: string } }) => setFilters({ ...filters, [key]: event.target.value }),
  });

  function view(event: FormEvent) {
    event.preventDefault();
    if (!filters.report) return setFilterError("Select a report type.");
    const next = { ...Object.fromEntries(Object.entries(filters).filter(([key, value]) => value && key !== "report")), report: filters.report, asOf: today } as ReportQuery;
    const parsed = reportQuerySchema.safeParse(next);
    if (!parsed.success) return setFilterError(parsed.error.issues[0]?.message);
    setFilterError(undefined);
    if (JSON.stringify(next) === JSON.stringify(query)) result.reload();
    else setQuery(next);
  }

  const data = result.data;
  const shownOffice = query?.officeId ? (lookups.data?.offices.find((office) => office.id === query.officeId)?.name ?? "—") : "All";
  const period = query ? `From Date: ${formatDay(query.from ?? "")} To Date: ${formatDay(query.to ?? "")}` : "";
  useReportExport(data && data.rows.length ? { title: `${data.title} — Office: ${shownOffice} — ${period}`, ...reportExport(data) } : null, onExport);

  return (
    <>
      <div>
        {open && (
          <form onSubmit={view} className="flex flex-col gap-3 p-4">
            <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SelectField label="Report Type" required options={[{ value: "", label: "Select Report Type" }, ...ANALYTICS.map((report) => ({ value: report.key, label: report.label }))]} {...field("report")} />
              <SelectField label="Office" required options={offices} {...field("officeId")} />
              <TextField label="From Date" type="date" required {...field("from")} />
              <TextField label="To Date" type="date" required {...field("to")} />
              <SelectField label={AREA_FILTER_LABELS.zone} options={areaOptions("ZONE")} {...field("zoneId")} />
              <SelectField label={AREA_FILTER_LABELS.customerGroup} options={groups} {...field("customerGroupId")} />
              <SelectField label={AREA_FILTER_LABELS.territory} options={areaOptions("TERRITORY")} {...field("territoryId")} />
              <SelectField label={AREA_FILTER_LABELS.route} options={areaOptions("ROUTE")} {...field("routeId")} />
            </div>
            <div>
              <Button type="submit" variant="primary" disabled={result.loading}>
                <RefreshCw aria-hidden="true" />
                View
              </Button>
            </div>
            {filterError && (
              <p role="alert" className="text-xs text-danger">
                {filterError}
              </p>
            )}
          </form>
        )}
        <div className="flex justify-end border-t border-line px-4 py-1.5">
          <Button size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>
            View Details
            {open ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
          </Button>
        </div>
      </div>

      <div className="border-t border-line">
        {!query ? (
          <EmptyState title="Choose a report type and press View" />
        ) : (
          <>
            <div className="flex flex-col items-center gap-1 border-b border-line px-4 py-3 text-center text-sm">
              <p className="text-base font-semibold text-ink">{ANALYTICS.find((report) => report.key === (query.report as ReportKey))?.label}</p>
              <p>
                <span className="font-semibold text-ink">Office:</span> <span className="text-ink-muted">{shownOffice}</span>
              </p>
              <p className="text-ink-muted">
                <span className="font-semibold text-ink">From Date:</span> {formatDay(query.from ?? "")} <span className="font-semibold text-ink">To Date:</span> {formatDay(query.to ?? "")}
              </p>
              {data?.note && <p className="text-xs text-ink-faint">{data.note}</p>}
            </div>
            {result.error ? (
              <ErrorState message={errorMessage(result.error)} onRetry={result.reload} />
            ) : !data ? (
              <LoadingState />
            ) : (
              <div aria-busy={result.loading} className={result.loading ? "opacity-60 transition-opacity" : undefined}>
                <ReportTable data={data} />
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
