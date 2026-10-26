"use client";

import { Download, FileSearch, Printer, RefreshCw, Search } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { CONTROL, CheckboxField, SelectField, TextField } from "@/components/ui/form-field";
import { Card, ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { addDays, useToday } from "@/features/sales/lib/use-today";
import { cellText } from "../lib/format";
import { REPORT_TYPES, reportQuerySchema, type Report, type ReportLookups, type ReportQuery, type ReportType } from "../schemas/report.schema";
import { downloadReportExcel, fetchReport, fetchReportLookups, reportPdfUrl } from "../services/report.api";

interface Filters {
  viewBy: ReportType;
  from: string;
  to: string;
  departmentId: string;
  departmentSectionId: string;
  officeId: string;
  workCenterId: string;
  filterBy: "item" | "category" | "bom";
  itemText: string;
  itemType: string;
  categoryId: string;
  subCategoryId: string;
  bomId: string;
  summary: boolean;
  materialsVariance: boolean;
  monthly: boolean;
  shiftWise: boolean;
  workCenterWise: boolean;
}

/** Which controls each "View By" shows (Managerium's filter matrix). */
const CONTROLS: Record<ReportType, { office?: boolean; workCenter?: boolean; filterBy?: ("item" | "category" | "bom")[]; itemType?: boolean; item?: boolean; print?: boolean }> = {
  production: { filterBy: ["item", "category", "bom"], print: true },
  consumption: { office: true, filterBy: ["item", "category"], itemType: true, print: true },
  performance: { workCenter: true, print: true },
  "process-date": { item: true },
  details: { workCenter: true, print: true },
  "details-view": { workCenter: true, print: true },
  demand: { office: true, item: true, print: true },
  cogs: { workCenter: true, print: true },
  utilization: { workCenter: true, print: true },
  downtime: { workCenter: true, print: true },
};

const itemOptionLabel = (item: ReportLookups["items"][number]) => `${item.code} - ${item.name}`;

/** /production/reports: Managerium's "Production Report" with its View By modes. Waits for the browser's date. */
export function ProductionReportView() {
  const today = useToday();
  return today ? <Reports today={today} /> : <LoadingState />;
}

function Reports({ today }: { today: string }) {
  const toast = useToast();
  const lookups = useResource("production-report-lookups", fetchReportLookups);
  const [filters, setFilters] = useState<Filters>({
    viewBy: "production",
    from: addDays(today, -30),
    to: today,
    departmentId: "",
    departmentSectionId: "",
    officeId: "",
    workCenterId: "",
    filterBy: "item",
    itemText: "",
    itemType: "",
    categoryId: "",
    subCategoryId: "",
    bomId: "",
    summary: false,
    materialsVariance: false,
    monthly: false,
    shiftWise: false,
    workCenterWise: false,
  });
  const [applied, setApplied] = useState<ReportQuery | null>(null);
  const [formError, setFormError] = useState<string>();
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const report = useResource(applied ? `production-report:${JSON.stringify(applied)}` : null, () => fetchReport(applied!));

  const options = lookups.data;
  const controls = CONTROLS[filters.viewBy];
  const set = (patch: Partial<Filters>) => setFilters((current) => ({ ...current, ...patch }));
  const itemByLabel = useMemo(() => new Map((options?.items ?? []).map((item) => [itemOptionLabel(item), item.id])), [options]);
  const sections = (options?.sections ?? []).filter((section) => !filters.departmentId || section.departmentId === filters.departmentId);
  const categories = (options?.categories ?? []).filter((category) => category.level === 1);
  const subCategories = (options?.categories ?? []).filter((category) => category.level === 2 && category.parentId === filters.categoryId);
  const showItem = controls.item || (controls.filterBy && filters.filterBy === "item");
  const showCategory = controls.filterBy?.includes("category") && (filters.filterBy === "category" || filters.viewBy === "consumption");
  const showBom = controls.filterBy?.includes("bom") && filters.filterBy === "bom";

  /** The query for the current controls, or an error message. */
  function build(): ReportQuery | string {
    const itemId = showItem && filters.itemText.trim() ? itemByLabel.get(filters.itemText.trim()) : undefined;
    if (showItem && filters.itemText.trim() && !itemId) return "Choose the item from the list.";
    const query: ReportQuery = {
      viewBy: filters.viewBy,
      from: filters.from,
      to: filters.to,
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters.departmentSectionId ? { departmentSectionId: filters.departmentSectionId } : {}),
      ...(controls.office && filters.officeId ? { officeId: filters.officeId } : {}),
      ...(controls.workCenter && filters.workCenterId ? { workCenterId: filters.workCenterId } : {}),
      ...(controls.filterBy ? { filterBy: filters.filterBy } : {}),
      ...(itemId ? { itemId } : {}),
      ...(controls.itemType && filters.itemType ? { itemType: filters.itemType } : {}),
      ...(showCategory && filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(showCategory && filters.subCategoryId ? { subCategoryId: filters.subCategoryId } : {}),
      ...(showBom && filters.bomId ? { bomId: filters.bomId } : {}),
      ...(filters.viewBy === "production" && filters.summary ? { summary: true } : {}),
      ...(filters.viewBy === "consumption" && filters.materialsVariance ? { materialsVariance: true } : {}),
      ...(filters.viewBy === "consumption" && filters.monthly ? { monthly: true } : {}),
      ...(filters.viewBy === "performance" && filters.shiftWise ? { shiftWise: true } : {}),
      ...(filters.viewBy === "performance" && filters.workCenterWise ? { workCenterWise: true } : {}),
    };
    const parsed = reportQuerySchema.safeParse(query);
    return parsed.success ? query : (parsed.error.issues[0]?.message ?? "Check the filters.");
  }

  function view(event: FormEvent) {
    event.preventDefault();
    const query = build();
    if (typeof query === "string") return setFormError(query);
    setFormError(undefined);
    if (JSON.stringify(query) === JSON.stringify(applied)) report.reload();
    else setApplied(query);
  }

  function print() {
    const query = build();
    if (typeof query === "string") return setFormError(query);
    setFormError(undefined);
    window.open(reportPdfUrl(query), "_blank", "noopener");
  }

  async function excel() {
    const query = applied ?? build();
    if (typeof query === "string") return setFormError(query);
    setExporting(true);
    try {
      await downloadReportExcel(query);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setExporting(false);
    }
  }

  return (
    <PageContainer className="max-w-none">
      <PageHead
        title="Production Report"
        actions={
          <>
            <label className="relative w-56">
              <span className="sr-only">Search the report</span>
              <Search aria-hidden="true" className="pointer-events-none absolute top-1.5 left-2 size-4 text-ink-faint" />
              <input type="search" value={search} placeholder="Search…" onChange={(event) => setSearch(event.target.value)} className={cn(CONTROL, "h-7 pl-7")} />
            </label>
            <Button onClick={excel} loading={exporting}>
              <Download aria-hidden="true" />
              Excel
            </Button>
          </>
        }
      />
      <div className="flex flex-col gap-4">
        <Card className="p-4">
          <form onSubmit={view} className="grid items-end gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <SelectField
              label="View By"
              required
              value={filters.viewBy}
              options={REPORT_TYPES.map((type) => ({ value: type.id, label: type.label }))}
              onChange={(event) => {
                set({ viewBy: event.target.value as ReportType });
                setApplied(null);
                setFormError(undefined);
              }}
            />
            <TextField label="From Date" type="date" required value={filters.from} max={filters.to} onChange={(event) => set({ from: event.target.value })} />
            <TextField label="To Date" type="date" required value={filters.to} min={filters.from} onChange={(event) => set({ to: event.target.value })} />
            <SelectField
              label="Department"
              value={filters.departmentId}
              options={[{ value: "", label: "All" }, ...(options?.departments ?? []).map((department) => ({ value: department.id, label: department.name }))]}
              onChange={(event) => set({ departmentId: event.target.value, departmentSectionId: "" })}
            />
            <SelectField
              label="Section"
              value={filters.departmentSectionId}
              options={[{ value: "", label: "All" }, ...sections.map((section) => ({ value: section.id, label: section.name }))]}
              onChange={(event) => set({ departmentSectionId: event.target.value })}
            />
            {controls.office && (
              <SelectField
                label="Office"
                value={filters.officeId}
                options={[{ value: "", label: "All" }, ...(options?.offices ?? []).map((office) => ({ value: office.id, label: office.name }))]}
                onChange={(event) => set({ officeId: event.target.value })}
              />
            )}
            {controls.workCenter && (
              <SelectField
                label="Work Center"
                value={filters.workCenterId}
                options={[{ value: "", label: "All" }, ...(options?.workCenters ?? []).map((center) => ({ value: center.id, label: `${center.code} - ${center.name}` }))]}
                onChange={(event) => set({ workCenterId: event.target.value })}
              />
            )}
            {controls.filterBy && (
              <SelectField
                label="Filter by"
                value={filters.filterBy}
                options={controls.filterBy.map((by) => ({ value: by, label: by === "bom" ? "BOM" : by === "item" ? "Item" : "Category" }))}
                onChange={(event) => set({ filterBy: event.target.value as Filters["filterBy"] })}
              />
            )}
            {controls.itemType && (
              <SelectField
                label="Item Type"
                value={filters.itemType}
                options={[{ value: "", label: "All" }, ...(options?.itemTypes ?? []).map((type) => ({ value: type, label: type }))]}
                onChange={(event) => set({ itemType: event.target.value })}
              />
            )}
            {showCategory && (
              <>
                <SelectField
                  label="Category"
                  value={filters.categoryId}
                  options={[{ value: "", label: "All" }, ...categories.map((category) => ({ value: category.id, label: category.name }))]}
                  onChange={(event) => set({ categoryId: event.target.value, subCategoryId: "" })}
                />
                <SelectField
                  label="Sub Category"
                  value={filters.subCategoryId}
                  disabled={!filters.categoryId || subCategories.length === 0}
                  options={[{ value: "", label: "All" }, ...subCategories.map((category) => ({ value: category.id, label: category.name }))]}
                  onChange={(event) => set({ subCategoryId: event.target.value })}
                />
              </>
            )}
            {showBom && (
              <SelectField
                label="BOM"
                value={filters.bomId}
                options={[{ value: "", label: "All" }, ...(options?.boms ?? []).map((bom) => ({ value: bom.id, label: bom.name }))]}
                onChange={(event) => set({ bomId: event.target.value })}
              />
            )}
            {showItem && (
              <>
                <TextField
                  label="Item"
                  list="production-report-items"
                  placeholder="Select/Search Item"
                  value={filters.itemText}
                  onChange={(event) => set({ itemText: event.target.value })}
                />
                <datalist id="production-report-items">
                  {(options?.items ?? []).map((item) => (
                    <option key={item.id} value={itemOptionLabel(item)} />
                  ))}
                </datalist>
              </>
            )}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:col-span-2 lg:col-span-4">
              {filters.viewBy === "production" && <CheckboxField label="Summary" checked={filters.summary} onChange={(event) => set({ summary: event.target.checked })} />}
              {filters.viewBy === "consumption" && (
                <>
                  <CheckboxField label="Materials Variance Report" checked={filters.materialsVariance} onChange={(event) => set({ materialsVariance: event.target.checked })} />
                  <CheckboxField label="Monthly" checked={filters.monthly} onChange={(event) => set({ monthly: event.target.checked })} />
                </>
              )}
              {filters.viewBy === "performance" && (
                <>
                  <CheckboxField label="Shift Wise" checked={filters.shiftWise} onChange={(event) => set({ shiftWise: event.target.checked })} />
                  <CheckboxField label="Work Center Wise" checked={filters.workCenterWise} onChange={(event) => set({ workCenterWise: event.target.checked })} />
                </>
              )}
              <div className="ml-auto flex gap-2">
                <Button type="submit" variant="primary" disabled={report.loading}>
                  <RefreshCw aria-hidden="true" />
                  View
                </Button>
                {controls.print && (
                  <Button onClick={print}>
                    <Printer aria-hidden="true" />
                    Print
                  </Button>
                )}
              </div>
            </div>
            {formError && (
              <p role="alert" className="text-sm text-danger sm:col-span-2 lg:col-span-4">
                {formError}
              </p>
            )}
          </form>
        </Card>

        <Card>
          {!applied ? (
            <NoData company={options?.company} hint="Choose the filters and press View." />
          ) : report.error ? (
            <ErrorState message={errorMessage(report.error)} onRetry={report.reload} />
          ) : !report.data ? (
            <LoadingState label="Building the report…" />
          ) : (
            <ReportBody report={report.data} search={search} busy={report.loading} />
          )}
        </Card>
      </div>
    </PageContainer>
  );
}

function NoData({ company, hint }: { company?: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <FileSearch aria-hidden="true" className="size-10 text-ink-faint" />
      {company && <p className="text-sm font-semibold tracking-wide text-accent-strong uppercase">{company}</p>}
      <p className="text-lg font-bold text-ink-muted">No Data Found</p>
      {hint && <p className="text-sm text-ink-faint">{hint}</p>}
    </div>
  );
}

function ReportBody({ report, search, busy }: { report: Report; search: string; busy: boolean }) {
  const needle = search.trim().toLowerCase();
  const rows = needle
    ? report.rows.filter((row) => report.columns.some((column) => cellText(column.kind, row[column.key]).toLowerCase().includes(needle)))
    : report.rows;
  const numeric = (kind: string) => kind !== "text" && kind !== "date";
  return (
    <section aria-labelledby="report-title" className={cn("flex flex-col gap-3 p-4", busy && "opacity-60")}>
      <header className="flex flex-col items-center gap-0.5 text-center">
        {report.company && <p className="text-sm font-semibold text-ink-muted">{report.company}</p>}
        <h2 id="report-title" className="text-lg font-semibold text-ink">
          {report.title}
        </h2>
        {report.subtitle.map((line) => (
          <p key={line} className="text-xs text-ink-faint">
            {line}
          </p>
        ))}
      </header>
      {rows.length === 0 ? (
        <NoData company={report.company} hint={needle ? "Nothing matches the search." : undefined} />
      ) : (
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full text-sm">
            <thead className="bg-accent-soft text-xs text-ink">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-semibold">
                  SL
                </th>
                {report.columns.map((column) => (
                  <th key={column.key} scope="col" className={cn("px-3 py-2 font-semibold whitespace-nowrap", numeric(column.kind) ? "text-right" : "text-left")}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-t border-line hover:bg-canvas">
                  <td className="px-3 py-2 text-ink-muted tabular-nums">{index + 1}</td>
                  {report.columns.map((column) => (
                    <td key={column.key} className={cn("px-3 py-2", numeric(column.kind) ? "text-right whitespace-nowrap text-ink tabular-nums" : "text-ink-muted")}>
                      {cellText(column.kind, row[column.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {report.totals && !needle && (
              <tfoot className="border-t-2 border-line-strong bg-canvas font-semibold text-ink">
                <tr>
                  <td className="px-3 py-2" />
                  {report.columns.map((column) => (
                    <td key={column.key} className={cn("px-3 py-2 whitespace-nowrap", numeric(column.kind) ? "text-right tabular-nums" : "text-left")}>
                      {report.totals![column.key] === undefined ? "" : cellText(column.kind, report.totals![column.key])}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
      {report.notes.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-ink-faint">
          {report.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
