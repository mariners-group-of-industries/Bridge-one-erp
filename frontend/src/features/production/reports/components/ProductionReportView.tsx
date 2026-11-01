"use client";

import { Download, FileSearch, Printer, RefreshCw, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { CONTROL, CheckboxField, TextField } from "@/components/ui/form-field";
import { Card, ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { Combobox } from "@/features/production/components/Combobox";
import { addDays, useToday } from "@/features/sales/lib/use-today";
import { cellText } from "../lib/format";
import {
  DOWNTIME_REASONS,
  MAX_MONTHS,
  REPORT_TYPES,
  WORK_CENTER_STATUSES,
  reportQuerySchema,
  type Report,
  type ReportQuery,
  type ReportType,
} from "../schemas/report.schema";
import { downloadReportExcel, fetchReport, fetchReportLookups, reportPdfUrl } from "../services/report.api";

interface Filters {
  viewBy: ReportType | "";
  from: string;
  to: string;
  fromMonth: string;
  toMonth: string;
  departmentId: string;
  departmentSectionId: string;
  officeId: string;
  workCenterId: string;
  filterBy: "item" | "category" | "bom";
  itemId: string;
  itemType: string;
  categoryId: string;
  subCategoryId: string;
  minorCategoryId: string;
  bomId: string;
  shift: string;
  workCenterStatus: "" | "ACTIVE" | "INACTIVE";
  downtimeReason: "" | "SHORT_RUN" | "NO_PRODUCTION";
  summary: boolean;
  materialsVariance: boolean;
  monthly: boolean;
  shiftWise: boolean;
  workCenterWise: boolean;
}

/**
 * A filter control. "department" is Department + Section, "dates" From / To Date,
 * "months" From / To Month and "categories" Category → Sub Category (→ Minor Category).
 */
type Field = "dates" | "months" | "department" | "office" | "workCenter" | "filterBy" | "itemType" | "categories" | "bom" | "item" | "shift" | "status" | "reason";
type Check = "summary" | "materialsVariance" | "monthly" | "shiftWise" | "workCenterWise";

interface Controls {
  /** The filters, in Managerium's order for this report. */
  fields: Field[];
  /** "Filter by" choices; the item / category / BOM control follows the choice. */
  filterBy?: ("item" | "category" | "bom")[];
  /** Category levels shown (2 = Category + Sub Category, 3 = + Minor Category). */
  categories?: 2 | 3;
  checks?: Check[];
  print?: boolean;
  /** Excel button beside View (every report also has the header Excel). */
  excel?: boolean;
}

/** Which controls each "View By" shows, in Managerium's order. */
const CONTROLS: Record<ReportType, Controls> = {
  production: { fields: ["department", "dates", "filterBy", "categories", "bom", "item"], filterBy: ["item", "category", "bom"], categories: 2, checks: ["summary"], print: true, excel: true },
  consumption: { fields: ["department", "office", "dates", "filterBy", "itemType", "categories", "item"], filterBy: ["item", "category"], categories: 2, checks: ["materialsVariance", "monthly"], print: true },
  performance: { fields: ["department", "workCenter", "dates"], checks: ["shiftWise", "workCenterWise"], print: true, excel: true },
  "process-date": { fields: ["department", "dates", "item"], excel: true },
  details: { fields: ["dates", "department", "workCenter", "shift", "categories"], categories: 2, print: true },
  "details-view": { fields: ["dates", "department", "workCenter", "shift"], print: true, excel: true },
  demand: { fields: ["department", "itemType", "categories", "item", "dates"], categories: 2 },
  cogs: { fields: ["workCenter", "categories", "dates"], categories: 3, print: true },
  utilization: { fields: ["dates", "workCenter", "department", "status"], checks: ["monthly"] },
  downtime: { fields: ["dates", "department", "workCenter", "reason"], checks: ["summary"], excel: true },
  "work-center": { fields: ["department", "workCenter", "months"], print: true },
  "output-consumption": { fields: ["department", "workCenter", "dates"], print: true, excel: true },
  "so-planning": { fields: ["department", "workCenter", "item", "dates"], print: true, excel: true },
  defect: { fields: ["department", "workCenter", "dates"], print: true, excel: true },
};

const CHECK_LABELS: Record<Check, string> = {
  summary: "Summary",
  materialsVariance: "Materials Variance Report",
  monthly: "Monthly",
  shiftWise: "Shift Wise",
  workCenterWise: "Work Center Wise",
};

/** Last day of a "YYYY-MM" month. */
function monthEnd(month: string) {
  const [year, index] = month.split("-").map(Number);
  return new Date(Date.UTC(year, index, 0)).toISOString().slice(0, 10);
}

/** /production/reports: Managerium's "Production Report" with its View By modes. Waits for the browser's date. */
export function ProductionReportView() {
  const today = useToday();
  return today ? <Reports today={today} /> : <LoadingState />;
}

function Reports({ today }: { today: string }) {
  const toast = useToast();
  const lookups = useResource("production-report-lookups", fetchReportLookups);
  const [filters, setFilters] = useState<Filters>({
    viewBy: "",
    from: addDays(today, -30),
    to: today,
    fromMonth: `${today.slice(0, 4)}-01`,
    toMonth: today.slice(0, 7),
    departmentId: "",
    departmentSectionId: "",
    officeId: "",
    workCenterId: "",
    filterBy: "item",
    itemId: "",
    itemType: "",
    categoryId: "",
    subCategoryId: "",
    minorCategoryId: "",
    bomId: "",
    shift: "",
    workCenterStatus: "",
    downtimeReason: "",
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
  const controls = filters.viewBy ? CONTROLS[filters.viewBy] : null;
  const has = (field: Field) => !!controls?.fields.includes(field);
  const set = (patch: Partial<Filters>) => setFilters((current) => ({ ...current, ...patch }));
  const sections = (options?.sections ?? []).filter((section) => !filters.departmentId || section.departmentId === filters.departmentId);
  const categoriesOf = (level: number, parentId?: string) =>
    (options?.categories ?? []).filter((category) => category.level === level && (level === 1 || category.parentId === parentId));
  // With a "Filter by", the item / category / BOM control follows the choice (Consumption always shows its categories).
  const byChoice = (choice: Filters["filterBy"]) => !controls?.filterBy || filters.filterBy === choice;
  const showItem = has("item") && byChoice("item");
  const showBom = has("bom") && byChoice("bom");
  const categoryLevels = has("categories") && (byChoice("category") || filters.viewBy === "consumption") ? (controls?.categories ?? 0) : 0;
  const checked = (check: Check) => !!controls?.checks?.includes(check) && filters[check];

  /** The query for the current controls, or an error message. */
  function build(): ReportQuery | string {
    if (!filters.viewBy || !controls) return "Choose the report (View By).";
    const months = has("months");
    if (months && (!filters.fromMonth || !filters.toMonth)) return "From Month and To Month are required.";
    const query: ReportQuery = {
      viewBy: filters.viewBy,
      from: months ? `${filters.fromMonth}-01` : filters.from,
      to: months ? monthEnd(filters.toMonth) : filters.to,
      ...(has("department") && filters.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(has("department") && filters.departmentSectionId ? { departmentSectionId: filters.departmentSectionId } : {}),
      ...(has("office") && filters.officeId ? { officeId: filters.officeId } : {}),
      ...(has("workCenter") && filters.workCenterId ? { workCenterId: filters.workCenterId } : {}),
      ...(controls.filterBy ? { filterBy: filters.filterBy } : {}),
      ...(showItem && filters.itemId ? { itemId: filters.itemId } : {}),
      ...(has("itemType") && filters.itemType ? { itemType: filters.itemType } : {}),
      ...(categoryLevels >= 1 && filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(categoryLevels >= 2 && filters.subCategoryId ? { subCategoryId: filters.subCategoryId } : {}),
      ...(categoryLevels >= 3 && filters.minorCategoryId ? { minorCategoryId: filters.minorCategoryId } : {}),
      ...(showBom && filters.bomId ? { bomId: filters.bomId } : {}),
      ...(has("shift") && filters.shift ? { shift: filters.shift } : {}),
      ...(has("status") && filters.workCenterStatus ? { workCenterStatus: filters.workCenterStatus } : {}),
      ...(has("reason") && filters.downtimeReason ? { downtimeReason: filters.downtimeReason } : {}),
      ...(checked("summary") ? { summary: true } : {}),
      ...(checked("materialsVariance") ? { materialsVariance: true } : {}),
      ...(checked("monthly") ? { monthly: true } : {}),
      ...(checked("shiftWise") ? { shiftWise: true } : {}),
      ...(checked("workCenterWise") ? { workCenterWise: true } : {}),
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

  const pick = (label: string, value: string, rows: readonly { value: string; label: string }[], onChange: (value: string) => void, extra?: { disabled?: boolean; placeholder?: string }) => (
    <Combobox key={label} label={label} placeholder={extra?.placeholder ?? label} value={value} options={rows} disabled={extra?.disabled} emptyText={`No ${label.toLowerCase()} matches.`} onChange={onChange} />
  );

  const categoryPick = (level: 1 | 2 | 3) => {
    const field = level === 1 ? "categoryId" : level === 2 ? "subCategoryId" : "minorCategoryId";
    const parent = level === 2 ? filters.categoryId : level === 3 ? filters.subCategoryId : undefined;
    const rows = categoriesOf(level, parent);
    const label = level === 1 ? "Category" : level === 2 ? "Sub Category" : "Minor Category";
    return pick(
      label,
      filters[field],
      rows.map((category) => ({ value: category.id, label: category.name })),
      (value) => set(level === 1 ? { categoryId: value, subCategoryId: "", minorCategoryId: "" } : level === 2 ? { subCategoryId: value, minorCategoryId: "" } : { minorCategoryId: value }),
      { disabled: level > 1 && (!parent || rows.length === 0) },
    );
  };

  /** The control(s) of one filter, in the report's order. */
  function control(field: Field) {
    switch (field) {
      case "dates":
        return [
          <TextField key="from" label="From Date" type="date" required value={filters.from} max={filters.to} onChange={(event) => set({ from: event.target.value })} />,
          <TextField key="to" label="To Date" type="date" required value={filters.to} min={filters.from} onChange={(event) => set({ to: event.target.value })} />,
        ];
      case "months":
        return [
          <TextField key="fromMonth" label="From Month" type="month" required value={filters.fromMonth} max={filters.toMonth} onChange={(event) => set({ fromMonth: event.target.value })} />,
          <TextField
            key="toMonth"
            label={`To Month (Max ${MAX_MONTHS} months)`}
            type="month"
            required
            value={filters.toMonth}
            min={filters.fromMonth}
            onChange={(event) => set({ toMonth: event.target.value })}
          />,
        ];
      case "department":
        return [
          pick(
            "Department",
            filters.departmentId,
            (options?.departments ?? []).map((department) => ({ value: department.id, label: department.name })),
            (departmentId) => set({ departmentId, departmentSectionId: "" }),
            { placeholder: "All" },
          ),
          pick("Section", filters.departmentSectionId, sections.map((section) => ({ value: section.id, label: section.name })), (departmentSectionId) => set({ departmentSectionId }), { placeholder: "All" }),
        ];
      case "office":
        return pick("Office", filters.officeId, (options?.offices ?? []).map((office) => ({ value: office.id, label: office.name })), (officeId) => set({ officeId }), { placeholder: "All" });
      case "workCenter":
        return pick(
          "Work Center",
          filters.workCenterId,
          (options?.workCenters ?? []).map((center) => ({ value: center.id, label: `${center.code} - ${center.name}` })),
          (workCenterId) => set({ workCenterId }),
        );
      case "filterBy":
        return pick(
          "Filter by",
          filters.filterBy,
          (controls?.filterBy ?? []).map((by) => ({ value: by, label: by === "bom" ? "BOM" : by === "item" ? "Item" : "Category" })),
          (value) => set({ filterBy: (value || "item") as Filters["filterBy"] }),
        );
      case "itemType":
        return pick("Item Type", filters.itemType, (options?.itemTypes ?? []).map((type) => ({ value: type, label: type })), (itemType) => set({ itemType }));
      case "categories":
        return categoryLevels ? [categoryPick(1), ...(categoryLevels >= 2 ? [categoryPick(2)] : []), ...(categoryLevels >= 3 ? [categoryPick(3)] : [])] : null;
      case "bom":
        return showBom ? pick("BOM", filters.bomId, (options?.boms ?? []).map((bom) => ({ value: bom.id, label: bom.name })), (bomId) => set({ bomId }), { placeholder: "All" }) : null;
      case "item":
        return showItem
          ? pick(
              "Item",
              filters.itemId,
              (options?.items ?? [])
                .filter((item) => !filters.itemType || item.itemType === filters.itemType)
                .map((item) => ({ value: item.id, label: `${item.code} - ${item.name}` })),
              (itemId) => set({ itemId }),
              { placeholder: "Select/Search Item" },
            )
          : null;
      case "shift":
        return pick("Shift", filters.shift, (options?.shifts ?? []).map((shift) => ({ value: shift, label: shift })), (shift) => set({ shift }));
      case "status":
        return pick(
          "Status",
          filters.workCenterStatus,
          WORK_CENTER_STATUSES.map((status) => ({ value: status.id, label: status.label })),
          (value) => set({ workCenterStatus: value as Filters["workCenterStatus"] }),
        );
      case "reason":
        return pick(
          "Reason",
          filters.downtimeReason,
          DOWNTIME_REASONS.map((reason) => ({ value: reason.id, label: reason.label })),
          (value) => set({ downtimeReason: value as Filters["downtimeReason"] }),
        );
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
            <Button onClick={excel} loading={exporting} disabled={!filters.viewBy}>
              <Download aria-hidden="true" />
              EXCEL
            </Button>
          </>
        }
      />
      <div className="flex flex-col gap-4">
        <Card className="p-4">
          <form onSubmit={view} className="flex flex-col gap-3">
            {/* As in Managerium: View By on its own line, then the report's filters. */}
            <Combobox
              className="w-full lg:w-1/3"
              label="View By"
              required
              placeholder="Select report"
              value={filters.viewBy}
              options={REPORT_TYPES.map((type) => ({ value: type.id, label: type.label }))}
              emptyText="No report matches."
              onChange={(value) => {
                set({ viewBy: value as ReportType | "" });
                setApplied(null);
                setFormError(undefined);
              }}
            />
            {controls && (
              <>
                <hr className="border-line" />
                <div className="grid items-end gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">{controls.fields.map((field) => control(field))}</div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  {controls.checks?.map((check) => (
                    <CheckboxField key={check} label={CHECK_LABELS[check]} checked={filters[check]} onChange={(event) => set({ [check]: event.target.checked })} />
                  ))}
                  <div className="flex gap-2">
                    <Button type="submit" variant="primary" disabled={report.loading}>
                      <RefreshCw aria-hidden="true" />
                      View
                    </Button>
                    {controls.print && (
                      <Button variant="primary" onClick={print}>
                        <Printer aria-hidden="true" />
                        Print
                      </Button>
                    )}
                    {controls.excel && (
                      <Button onClick={excel} loading={exporting}>
                        <Download aria-hidden="true" />
                        Excel
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
            {formError && (
              <p role="alert" className="text-sm text-danger">
                {formError}
              </p>
            )}
          </form>
        </Card>

        {filters.viewBy && (
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
        )}
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
