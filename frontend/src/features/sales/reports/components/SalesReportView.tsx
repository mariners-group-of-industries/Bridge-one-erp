"use client";

import { Download, Printer, RefreshCw } from "lucide-react";
import { useState, type FormEvent } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { CheckboxField, SelectField, TextField } from "@/components/ui/form-field";
import { Card, EmptyState, ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { useFilterLookups } from "../../deliveries/components/DeliveryWorkspaceView";
import { downloadCsv } from "../../lib/csv";
import { printTable } from "../../lib/print-table";
import { addDays, formatDay, useToday } from "../../lib/use-today";
import { CATEGORY_LEVEL_LABELS } from "../../masters/schemas/masters.schema";
import { fetchCustomers } from "../../masters/services/masters.api";
import { MONTH_NAMES } from "../../targets/schemas/target.schema";
import { REPORTS, reportQuerySchema, type ReportFilter, type ReportKey, type ReportQuery, type ReportResult } from "../schemas/report.schema";
import { fetchReport } from "../services/report.api";
import { ReportTable, reportExport } from "./ReportTable";

type Filters = Record<"officeId" | "priceListId" | "customerGroupId" | "customerId" | "salesPersonId" | "territoryId" | "categoryId" | "from" | "to" | "utilization" | "year" | "fromMonth" | "toMonth", string> & {
  summary: boolean;
};

const all = { value: "", label: "All" };
/** Sales Report: one "View By" list of reports, each with its own filters. */
export function SalesReportView() {
  const today = useToday();
  if (!today) {
    return (
      <PageContainer>
        <PageHead title="Sales Report" />
        <LoadingState />
      </PageContainer>
    );
  }
  return <Reports today={today} />;
}

function Reports({ today }: { today: string }) {
  const toast = useToast();
  const { lookups, setup, offices, groups, persons, areaOptions } = useFilterLookups();
  const units = [...new Set((lookups.data?.offices ?? []).map((office) => office.businessUnitId))];
  const customers = useResource(units.length ? `report-customers:${units.join(",")}` : null, async () => (await Promise.all(units.map((unit) => fetchCustomers(unit, true)))).flat());

  const [report, setReport] = useState<ReportKey>("available-balance");
  const [filters, setFilters] = useState<Filters>({
    officeId: "",
    priceListId: "",
    customerGroupId: "",
    customerId: "",
    salesPersonId: "",
    territoryId: "",
    categoryId: "",
    from: addDays(today, -30),
    to: today,
    utilization: "",
    year: today.slice(0, 4),
    fromMonth: "1",
    toMonth: String(Number(today.slice(5, 7))),
    summary: false,
  });
  const [query, setQuery] = useState<ReportQuery | null>(null);
  const [filterError, setFilterError] = useState<string>();
  const result = useResource(query ? `report:${JSON.stringify(query)}` : null, () => fetchReport(query!));

  const definition = REPORTS.find((candidate) => candidate.key === report)!;
  const shows = (filter: ReportFilter) => (definition.filters as readonly ReportFilter[]).includes(filter);
  const required = (filter: ReportFilter) => "required" in definition && (definition.required as readonly ReportFilter[]).includes(filter);
  const field = (key: Exclude<keyof Filters, "summary">) => ({
    value: filters[key],
    onChange: (event: { target: { value: string } }) => setFilters({ ...filters, [key]: event.target.value }),
  });

  function view(event: FormEvent) {
    event.preventDefault();
    const used: Record<string, string> = { report, asOf: today };
    const keep = (filter: ReportFilter, key: Exclude<keyof Filters, "summary">) => {
      if (shows(filter) && filters[key]) used[key] = filters[key];
    };
    keep("office", "officeId");
    keep("priceList", "priceListId");
    keep("customerGroup", "customerGroupId");
    keep("customer", "customerId");
    keep("salesPerson", "salesPersonId");
    keep("territory", "territoryId");
    keep("category", "categoryId");
    keep("from", "from");
    keep("to", "to");
    keep("utilization", "utilization");
    keep("year", "year");
    if (shows("months")) {
      used.fromMonth = filters.fromMonth;
      used.toMonth = filters.toMonth;
    }
    if (shows("summary") && filters.summary) used.summary = "true";
    if (required("customer") && !used.customerId) return setFilterError("Select a customer.");
    const parsed = reportQuerySchema.safeParse(used);
    if (!parsed.success) return setFilterError(parsed.error.issues[0]?.message);
    setFilterError(undefined);
    if (JSON.stringify(used) === JSON.stringify(query)) result.reload();
    else setQuery(used as ReportQuery);
  }

  const data: ReportResult | undefined = query?.report === report ? result.data : undefined;
  const { headers, rows: tableRows } = data ? reportExport(data) : { headers: [], rows: [] };
  const period = shows("from") ? ` ${formatDay(filters.from)} – ${formatDay(filters.to)}` : "";

  const categories = (setup.data?.categories ?? []).map((category) => ({ value: category.id, label: `${category.name} (${CATEGORY_LEVEL_LABELS[category.level]})` }));
  const years = Array.from({ length: 5 }, (_, index) => String(Number(today.slice(0, 4)) - 3 + index));
  const months = MONTH_NAMES.map((name, index) => ({ value: String(index + 1), label: name }));

  return (
    <PageContainer className="max-w-none">
      <PageHead
        title="Sales Report"
        actions={
          <>
            <Button onClick={() => data && downloadCsv(`${report}-${today}.csv`, headers, tableRows)} disabled={!data || data.rows.length === 0}>
              <Download aria-hidden="true" />
              Excel
            </Button>
            <Button onClick={() => data && !printTable(`${data.title}${period}`, headers, tableRows) && toast.error("Allow pop-ups to print or save as PDF.")} disabled={!data || data.rows.length === 0}>
              <Printer aria-hidden="true" />
              PDF
            </Button>
          </>
        }
      />
      <Card>
        <form onSubmit={view} className="flex flex-col gap-3 border-b border-line p-4">
          <SelectField
            label="View By"
            required
            className="max-w-xl"
            value={report}
            options={REPORTS.map((candidate) => ({ value: candidate.key, label: candidate.label }))}
            onChange={(event) => {
              setReport(event.target.value as ReportKey);
              setFilterError(undefined);
            }}
          />
          <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            {shows("office") && <SelectField label="Office" options={offices} {...field("officeId")} />}
            {shows("priceList") && <SelectField label="Price Type" options={[all, ...(setup.data?.priceLists ?? []).map((list) => ({ value: list.id, label: list.name }))]} {...field("priceListId")} />}
            {shows("customerGroup") && <SelectField label="Customer Group" options={groups} {...field("customerGroupId")} />}
            {shows("customer") && (
              <SelectField
                label={required("customer") ? "Select Customer" : "Customer"}
                required={required("customer")}
                options={[required("customer") ? { value: "", label: "Select customer" } : all, ...(customers.data ?? []).map((customer) => ({ value: customer.id, label: `${customer.code} - ${customer.name}` }))]}
                {...field("customerId")}
              />
            )}
            {shows("territory") && <SelectField label="Territory" options={areaOptions("TERRITORY")} {...field("territoryId")} />}
            {shows("salesPerson") && <SelectField label="Sales Force" options={persons} {...field("salesPersonId")} />}
            {shows("category") && <SelectField label="Item Category" options={[all, ...categories]} {...field("categoryId")} />}
            {shows("utilization") && <TextField label="Credit Utilization %" type="number" min={0} step="any" placeholder="At least …" {...field("utilization")} />}
            {shows("year") && <SelectField label="Year" required options={years.map((year) => ({ value: year, label: year }))} {...field("year")} />}
            {shows("months") && <SelectField label="From Month" required options={months} {...field("fromMonth")} />}
            {shows("months") && <SelectField label="To Month" required options={months} {...field("toMonth")} />}
            {shows("from") && <TextField label="From Date" type="date" required={required("from")} {...field("from")} />}
            {shows("to") && <TextField label="To Date" type="date" required={required("to")} {...field("to")} />}
            <div className="flex items-center gap-4">
              {shows("summary") && <CheckboxField label="Summary" checked={filters.summary} onChange={(event) => setFilters({ ...filters, summary: event.target.checked })} />}
              <Button type="submit" variant="primary" disabled={result.loading}>
                <RefreshCw aria-hidden="true" />
                View
              </Button>
            </div>
          </div>
          {filterError && (
            <p role="alert" className="text-xs text-danger">
              {filterError}
            </p>
          )}
        </form>

        {!query || query.report !== report ? (
          <EmptyState title="Choose the filters and press View" />
        ) : result.error ? (
          <ErrorState message={errorMessage(result.error)} onRetry={result.reload} />
        ) : !data ? (
          <LoadingState />
        ) : (
          <div aria-busy={result.loading} className={result.loading ? "opacity-60 transition-opacity" : undefined}>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line px-4 py-2.5">
              <h2 className="text-sm font-semibold text-ink">
                {data.title}
                <span className="font-normal text-ink-muted">{period}</span>
              </h2>
              {data.note && <p className="text-xs text-ink-muted">{data.note}</p>}
            </div>
            <ReportTable data={data} />
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
