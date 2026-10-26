"use client";

import { Download, Eye, Pencil, Plus, Printer, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/ui/dialog";
import { CheckboxField, SelectField, TextField } from "@/components/ui/form-field";
import { Card, EmptyState, ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatAmount, formatQty } from "../../dashboard/lib/format";
import { FilterForm, useFilterLookups } from "../../deliveries/components/DeliveryWorkspaceView";
import { downloadCsv } from "../../lib/csv";
import { printTable } from "../../lib/print-table";
import { addDays, formatDay, useToday } from "../../lib/use-today";
import { CATEGORY_LEVEL_LABELS } from "../../masters/schemas/masters.schema";
import { paths } from "../../paths";
import {
  BUDGET_BASIS_LABELS,
  COMMISSION_BASIS_LABELS,
  MONTH_NAMES,
  PLAN_BASIS_LABELS,
  TARGET_BASES,
  TARGET_TYPE_LABELS,
  commissionReportQuerySchema,
  planListQuerySchema,
  planReportQuerySchema,
  targetReportQuerySchema,
  type BudgetRow,
  type CommissionReportLine,
  type CommissionReportQuery,
  type CommissionRow,
  type CommissionSummaryRow,
  type PlanListQuery,
  type PlanReportQuery,
  type PlanReportRow,
  type PlanRow,
  type TargetReportQuery,
  type TargetReportRow,
} from "../schemas/target.schema";
import {
  deleteBudget,
  deleteCommission,
  deletePlan,
  fetchBudgets,
  fetchCommissionReport,
  fetchCommissions,
  fetchPlanReport,
  fetchPlans,
  fetchTargetReport,
} from "../services/target.api";
import { BudgetDetailsDialog, CommissionDetailsDialog } from "./TargetDetails";

type Tab = "target" | "target-report" | "sales-target" | "sales-target-report" | "commission-setup" | "commission-report";
const TABS: { id: Tab; label: string; title: string }[] = [
  { id: "target", label: "Target", title: "Target" },
  { id: "target-report", label: "Target Report", title: "Target Report" },
  { id: "sales-target", label: "Sales Target", title: "Sales Target" },
  { id: "sales-target-report", label: "Sales Target Report", title: "Sales Target Report" },
  { id: "commission-setup", label: "Commission Setup", title: "Commission Setup" },
  { id: "commission-report", label: "Commission Report", title: "Commission Report" },
];
const isTab = (value: string | null): value is Tab => TABS.some((tab) => tab.id === value);

interface TableExport {
  name: string;
  title: string;
  headers: string[];
  rows: (string | number | null)[][];
}

const all = { value: "", label: "All" };
const text = (value: string | null) => value ?? "N/A";
const sum = <T,>(rows: readonly T[], pick: (row: T) => number) => rows.reduce((total, row) => total + pick(row), 0);
const sl = <T,>(): Column<T> => ({ id: "sl", header: "SL", cell: (_row, index) => <span className="text-ink-faint tabular-nums">{index + 1}</span>, className: "w-10" });
const monthOptions = MONTH_NAMES.map((name, index) => ({ value: String(index + 1), label: name }));
const percentCell = (value: number | null) => (value === null ? "—" : <span className={cn("tabular-nums", value >= 100 ? "text-success" : value < 50 ? "text-danger" : "text-ink")}>{value.toFixed(2)}%</span>);

/** /sales/targets?tab=… — read the tab inside <Suspense> (search params are request-time). */
export function TargetWorkspaceView() {
  const today = useToday();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const tab: Tab = isTab(params.get("tab")) ? (params.get("tab") as Tab) : "target";
  const [table, setTable] = useState<TableExport | null>(null);
  const reportTab = tab === "target-report" || tab === "sales-target-report" || tab === "commission-report";

  const actions = (
    <>
      {tab === "target-report" && (
        <>
          <Button onClick={() => table && downloadCsv(`${table.name}-${today}.csv`, table.headers, table.rows)} disabled={!table}>
            <Download aria-hidden="true" />
            Excel
          </Button>
          <Link href={paths.newBudget} className={buttonClasses("primary")}>
            <Plus aria-hidden="true" />
            Target Report
          </Link>
        </>
      )}
      {tab === "sales-target-report" && (
        <>
          <Button onClick={() => table && downloadCsv(`${table.name}-${today}.csv`, table.headers, table.rows)} disabled={!table}>
            <Download aria-hidden="true" />
            Excel
          </Button>
          <Button onClick={() => table && !printTable(table.title, table.headers, table.rows) && toast.error("Allow pop-ups to print or save as PDF.")} disabled={!table}>
            <Printer aria-hidden="true" />
            Print/PDF
          </Button>
        </>
      )}
      {tab === "commission-report" && (
        <Button onClick={() => table && !printTable(table.title, table.headers, table.rows) && toast.error("Allow pop-ups to print or save as PDF.")} disabled={!table}>
          <Printer aria-hidden="true" />
          PRINT/PDF
        </Button>
      )}
      {tab === "target" && (
        <Link href={paths.newBudget} className={buttonClasses("primary")}>
          <Plus aria-hidden="true" />
          Target
        </Link>
      )}
      {tab === "sales-target" && (
        <>
          <Link href={paths.assignPlan()} className={buttonClasses("secondary")}>
            <UserPlus aria-hidden="true" />
            Assign
          </Link>
          <Link href={paths.newPlan} className={buttonClasses("primary")}>
            <Plus aria-hidden="true" />
            Sales Target
          </Link>
        </>
      )}
      {tab === "commission-setup" && (
        <Link href={paths.newCommission} className={buttonClasses("primary")}>
          <Plus aria-hidden="true" />
          Commission Setup
        </Link>
      )}
    </>
  );

  return (
    <PageContainer className="max-w-none">
      <PageHead title={TABS.find((candidate) => candidate.id === tab)!.title} actions={actions} />
      <Card>
        <Tabs<Tab> label="Target sections" tabs={TABS} value={tab} onChange={(next) => router.replace(`${pathname}?tab=${next}`)}>
          {!today ? (
            <LoadingState />
          ) : tab === "target" ? (
            <BudgetsTab key={tab} />
          ) : tab === "target-report" ? (
            <TargetReportTab key={tab} today={today} onExport={setTable} />
          ) : tab === "sales-target" ? (
            <PlansTab key={tab} today={today} />
          ) : tab === "sales-target-report" ? (
            <PlanReportTab key={tab} today={today} onExport={setTable} />
          ) : tab === "commission-setup" ? (
            <CommissionsTab key={tab} />
          ) : (
            <CommissionReportTab key={tab} today={today} onExport={setTable} />
          )}
        </Tabs>
      </Card>
    </PageContainer>
  );
}

function useTableExport(table: TableExport | null, onExport: (table: TableExport | null) => void) {
  const json = table ? JSON.stringify(table) : null;
  const latest = useRef(table);
  useEffect(() => {
    latest.current = table;
  });
  useEffect(() => {
    onExport(json ? latest.current : null);
  }, [json, onExport]);
  useEffect(() => () => onExport(null), [onExport]);
}

function Results<T>({ resource, children }: { resource: { data?: T; error?: Error | null; loading: boolean; reload: () => void }; children: (data: T) => React.ReactNode }) {
  if (resource.error) return <ErrorState message={errorMessage(resource.error)} onRetry={resource.reload} />;
  if (!resource.data) return <LoadingState />;
  return (
    <div aria-busy={resource.loading} className={resource.loading ? "opacity-60 transition-opacity" : undefined}>
      {children(resource.data)}
    </div>
  );
}

/** Delete with a confirmation; reloads the list afterwards. */
function useDelete(remove: (id: string) => Promise<void>, onDone: () => void) {
  const toast = useToast();
  const [pending, setPending] = useState<{ id: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      title={`Delete ${pending?.label ?? ""}?`}
      message="This cannot be undone."
      busy={busy}
      onClose={() => setPending(null)}
      onConfirm={async () => {
        if (!pending) return;
        setBusy(true);
        try {
          await remove(pending.id);
          toast.success(`${pending.label} deleted.`);
          setPending(null);
          onDone();
        } catch (error) {
          toast.error(errorMessage(error));
        } finally {
          setBusy(false);
        }
      }}
    />
  );
  return { ask: (id: string, label: string) => setPending({ id, label }), dialog };
}

// ─── Target ──────────────────────────────────────────────────────────────────

function BudgetsTab() {
  const list = useResource("target-budgets", fetchBudgets);
  const [viewing, setViewing] = useState<{ id: string; editable: boolean } | null>(null);
  const removal = useDelete(deleteBudget, list.reload);

  const columns: Column<BudgetRow>[] = [
    sl(),
    { id: "type", header: "Target Type", cell: (row) => TARGET_TYPE_LABELS[row.targetType] },
    { id: "basis", header: "Target Based On", cell: (row) => BUDGET_BASIS_LABELS[row.basis] },
    { id: "year", header: "Year", cell: (row) => row.year, sortValue: (row) => row.year },
    { id: "persons", header: "Sales Force", cell: (row) => row.personCount, className: "text-right tabular-nums", hideBelow: "md" },
    { id: "total", header: "Total Amount", cell: (row) => (row.basis === "QUANTITY" ? formatQty(row.total) : formatAmount(row.total)), sortValue: (row) => row.total, className: "text-right tabular-nums" },
    { id: "by", header: "Created By", cell: (row) => text(row.createdBy), hideBelow: "md" },
    {
      id: "actions",
      header: "Action",
      cell: (row) => (
        <span className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" aria-label={`View ${row.year} targets`} title="View" onClick={() => setViewing({ id: row.id, editable: false })}>
            <Eye />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Edit ${row.year} targets`} title="Edit" onClick={() => setViewing({ id: row.id, editable: true })}>
            <Pencil />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Delete ${row.year} targets`} title="Delete" onClick={() => removal.ask(row.id, `${BUDGET_BASIS_LABELS[row.basis]} ${row.year}`)}>
            <Trash2 />
          </Button>
        </span>
      ),
    },
  ];

  return (
    <>
      <Results resource={list}>
        {(rows) => (
          <DataTable
            rows={rows}
            columns={columns}
            getRowId={(row) => row.id}
            getRowLabel={(row) => `${row.year} ${row.basis}`}
            emptyState={
              <EmptyState title="No targets yet">
                <Link href={paths.newBudget} className="text-ink underline underline-offset-2">
                  Create a target
                </Link>
              </EmptyState>
            }
          />
        )}
      </Results>
      {viewing && (
        <BudgetDetailsDialog
          id={viewing.id}
          editable={viewing.editable}
          onClose={() => {
            setViewing(null);
            list.reload();
          }}
        />
      )}
      {removal.dialog}
    </>
  );
}

// ─── Target Report ───────────────────────────────────────────────────────────

function TargetReportTab({ today, onExport }: { today: string; onExport: (table: TableExport | null) => void }) {
  const { persons } = useFilterLookups();
  const year = Number(today.slice(0, 4));
  const [filters, setFilters] = useState({ searchBy: "ALL", salesPersonId: "", fromMonth: "1", toMonth: today.slice(5, 7).replace(/^0/, ""), year: String(year), basis: "AMOUNT" });
  const [query, setQuery] = useState<TargetReportQuery | null>(null);
  const [filterError, setFilterError] = useState<string>();
  const report = useResource(query ? `target-report:${JSON.stringify(query)}` : null, () => fetchTargetReport(query!));
  const quantity = query?.basis === "QUANTITY";
  const format = (value: number) => (quantity ? formatQty(value) : formatAmount(value));

  function view(event: FormEvent) {
    event.preventDefault();
    if (filters.searchBy === "EMPLOYEE" && !filters.salesPersonId) return setFilterError("Select an employee.");
    const next = { fromMonth: filters.fromMonth, toMonth: filters.toMonth, year: filters.year, basis: filters.basis, ...(filters.searchBy === "EMPLOYEE" ? { salesPersonId: filters.salesPersonId } : {}) } as TargetReportQuery;
    const parsed = targetReportQuerySchema.safeParse(next);
    if (!parsed.success) return setFilterError(parsed.error.issues[0]?.message);
    setFilterError(undefined);
    if (JSON.stringify(next) === JSON.stringify(query)) report.reload();
    else setQuery(next);
  }

  const rows = report.data;
  useTableExport(
    rows && query
      ? {
          name: "target-report",
          title: `Target Report ${MONTH_NAMES[Number(query.fromMonth) - 1]}–${MONTH_NAMES[Number(query.toMonth) - 1]} ${query.year} (${quantity ? "Quantity" : "Amount"})`,
          headers: ["SL", "Employee", "Designation", "Month", "Target", "Achieved", "Achievement %"],
          rows: rows.map((row, index) => [index + 1, row.name, row.designation, MONTH_NAMES[row.month - 1], row.target, row.achieved, row.percent === null ? "" : row.percent.toFixed(2)]),
        }
      : null,
    onExport,
  );

  const columns: Column<TargetReportRow>[] = [
    sl(),
    { id: "name", header: "Employee", cell: (row) => row.name, sortValue: (row) => row.name },
    { id: "designation", header: "Designation", cell: (row) => text(row.designation), hideBelow: "md" },
    { id: "month", header: "Month", cell: (row) => MONTH_NAMES[row.month - 1], sortValue: (row) => row.month },
    { id: "target", header: "Target", cell: (row) => format(row.target), sortValue: (row) => row.target, className: "text-right tabular-nums" },
    { id: "achieved", header: "Achieved", cell: (row) => format(row.achieved), sortValue: (row) => row.achieved, className: "text-right tabular-nums" },
    { id: "percent", header: "Achievement %", cell: (row) => percentCell(row.percent), sortValue: (row) => row.percent ?? -1, className: "text-right" },
  ];

  return (
    <>
      <FilterForm onSubmit={view} error={filterError} loading={report.loading}>
        <SelectField label="Search By" required options={[{ value: "ALL", label: "All Employees" }, { value: "EMPLOYEE", label: "Employee" }]} value={filters.searchBy} onChange={(event) => setFilters({ ...filters, searchBy: event.target.value })} />
        <SelectField label="Employee" options={persons} value={filters.salesPersonId} disabled={filters.searchBy !== "EMPLOYEE"} onChange={(event) => setFilters({ ...filters, salesPersonId: event.target.value })} />
        <SelectField label="From Month" required options={monthOptions} value={filters.fromMonth} onChange={(event) => setFilters({ ...filters, fromMonth: event.target.value })} />
        <SelectField label="To Month" required options={monthOptions} value={filters.toMonth} onChange={(event) => setFilters({ ...filters, toMonth: event.target.value })} />
        <SelectField
          label="Year"
          required
          options={[year - 2, year - 1, year, year + 1].map((value) => ({ value: String(value), label: String(value) }))}
          value={filters.year}
          onChange={(event) => setFilters({ ...filters, year: event.target.value })}
        />
        <SelectField label="Amount/Qty Wise" required options={TARGET_BASES.map((basis) => ({ value: basis, label: basis === "AMOUNT" ? "Amount Wise" : "Quantity Wise" }))} value={filters.basis} onChange={(event) => setFilters({ ...filters, basis: event.target.value })} />
      </FilterForm>
      {!query ? (
        <EmptyState title="No Data Found" subtitle="Choose the search criteria and press View" />
      ) : (
        <Results resource={report}>
          {(data) => (
            <DataTable
              rows={data}
              columns={columns}
              getRowId={(row) => `${row.salesPersonId}:${row.month}`}
              getRowLabel={(row) => `${row.name} ${MONTH_NAMES[row.month - 1]}`}
              search={{ placeholder: "Search employee", match: (row, needle) => row.name.toLowerCase().includes(needle) }}
              footer={(shown) => {
                const target = sum(shown, (row) => row.target);
                const achieved = sum(shown, (row) => row.achieved);
                return { month: "Total:", target: format(target), achieved: format(achieved), percent: percentCell(target > 0 ? Math.round((achieved / target) * 10_000) / 100 : null) };
              }}
              emptyState={<EmptyState title="No Data Found" subtitle="No records found matching the active filter criteria." />}
            />
          )}
        </Results>
      )}
    </>
  );
}

// ─── Sales Target ────────────────────────────────────────────────────────────

function PlansTab({ today }: { today: string }) {
  const { offices } = useFilterLookups();
  const initial = { officeId: "", from: addDays(today, -30), to: today, basis: "", name: "" };
  const [filters, setFilters] = useState(initial);
  const toQuery = (values: typeof initial) => Object.fromEntries(Object.entries(values).filter(([, value]) => value)) as PlanListQuery;
  const [query, setQuery] = useState<PlanListQuery>(toQuery(initial));
  const [filterError, setFilterError] = useState<string>();
  const list = useResource(`target-plans:${JSON.stringify(query)}`, () => fetchPlans(query));
  const removal = useDelete(deletePlan, list.reload);

  function view(event: FormEvent) {
    event.preventDefault();
    const next = toQuery(filters);
    const parsed = planListQuerySchema.safeParse(next);
    if (!parsed.success) return setFilterError(parsed.error.issues[0]?.message);
    setFilterError(undefined);
    if (JSON.stringify(next) === JSON.stringify(query)) list.reload();
    else setQuery(next);
  }

  const columns: Column<PlanRow>[] = [
    sl(),
    {
      id: "name",
      header: "Target Name",
      cell: (row) => (
        <Link href={paths.plan(row.id)} className="font-medium text-ink hover:underline">
          {row.name}
        </Link>
      ),
      sortValue: (row) => row.name,
    },
    { id: "number", header: "Target No", cell: (row) => <span className="whitespace-nowrap">{row.number}</span>, hideBelow: "lg" },
    { id: "office", header: "Office", cell: (row) => row.officeName, hideBelow: "md" },
    { id: "type", header: "Target Type", cell: (row) => PLAN_BASIS_LABELS[row.basis], hideBelow: "md" },
    { id: "start", header: "Start Date", cell: (row) => formatDay(row.startDate), sortValue: (row) => row.startDate, className: "whitespace-nowrap" },
    { id: "end", header: "End Date", cell: (row) => formatDay(row.endDate), className: "whitespace-nowrap" },
    { id: "amount", header: "Target Amount", cell: (row) => (row.basis === "QUANTITY" ? formatQty(row.targetAmount) : formatAmount(row.targetAmount)), className: "text-right tabular-nums" },
    { id: "customers", header: "Customers", cell: (row) => row.customers, className: "text-right tabular-nums", hideBelow: "lg" },
    { id: "assigned", header: "Assigned", cell: (row) => row.assigned, className: "text-right tabular-nums", hideBelow: "md" },
    { id: "by", header: "Created By", cell: (row) => text(row.createdBy), hideBelow: "lg" },
    {
      id: "actions",
      header: "Action",
      cell: (row) => (
        <span className="flex items-center gap-0.5">
          <Link href={paths.plan(row.id)} aria-label={`View ${row.name}`} title="View" className={buttonClasses("ghost", "icon")}>
            <Eye />
          </Link>
          <Link href={paths.editPlan(row.id)} aria-label={`Edit ${row.name}`} title="Edit" className={buttonClasses("ghost", "icon")}>
            <Pencil />
          </Link>
          <Link href={paths.assignPlan(row.id)} aria-label={`Assign ${row.name}`} title="Assign sales force" className={buttonClasses("ghost", "icon")}>
            <UserPlus />
          </Link>
          <Button variant="ghost" size="icon" aria-label={`Delete ${row.name}`} title="Delete" onClick={() => removal.ask(row.id, row.name)}>
            <Trash2 />
          </Button>
        </span>
      ),
    },
  ];

  return (
    <>
      <FilterForm onSubmit={view} error={filterError} loading={list.loading}>
        <SelectField label="Office" options={offices} value={filters.officeId} onChange={(event) => setFilters({ ...filters, officeId: event.target.value })} />
        <TextField label="From Date" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
        <TextField label="To Date" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
        <SelectField label="Target Type" options={[all, ...TARGET_BASES.map((basis) => ({ value: basis, label: PLAN_BASIS_LABELS[basis] }))]} value={filters.basis} onChange={(event) => setFilters({ ...filters, basis: event.target.value })} />
        <TextField label="Target Name" value={filters.name} onChange={(event) => setFilters({ ...filters, name: event.target.value })} />
      </FilterForm>
      <Results resource={list}>
        {(rows) => (
          <DataTable
            rows={rows}
            columns={columns}
            getRowId={(row) => row.id}
            getRowLabel={(row) => row.name}
            rowHref={(row) => paths.plan(row.id)}
            footer={(shown) => ({ end: "Total:", amount: formatAmount(sum(shown.filter((row) => row.basis === "AMOUNT"), (row) => row.targetAmount)) })}
            emptyState={<EmptyState title="No Data Found" subtitle="No sales targets found matching the active filter criteria." />}
          />
        )}
      </Results>
      {removal.dialog}
    </>
  );
}

// ─── Sales Target Report ─────────────────────────────────────────────────────

function PlanReportTab({ today, onExport }: { today: string; onExport: (table: TableExport | null) => void }) {
  const { offices, persons } = useFilterLookups();
  const plans = useResource("target-plans:all", () => fetchPlans({}));
  const initial = { officeId: "", planId: "", salesPersonId: "", designation: "", from: addDays(today, -30), to: today, byCustomerGroup: false };
  const [filters, setFilters] = useState(initial);
  const toQuery = (values: typeof initial) =>
    Object.fromEntries(Object.entries({ ...values, byCustomerGroup: values.byCustomerGroup ? "true" : "" }).filter(([, value]) => value)) as PlanReportQuery;
  const [query, setQuery] = useState<PlanReportQuery>(toQuery(initial));
  const [filterError, setFilterError] = useState<string>();
  const report = useResource(`plan-report:${JSON.stringify(query)}`, () => fetchPlanReport(query));
  const split = query.byCustomerGroup === "true";

  function view(event: FormEvent) {
    event.preventDefault();
    const next = toQuery(filters);
    const parsed = planReportQuerySchema.safeParse(next);
    if (!parsed.success) return setFilterError(parsed.error.issues[0]?.message);
    setFilterError(undefined);
    if (JSON.stringify(next) === JSON.stringify(query)) report.reload();
    else setQuery(next);
  }

  const rows = report.data;
  useTableExport(
    rows
      ? {
          name: "sales-target-report",
          title: "Sales Target Report",
          headers: ["SL", "Target", "Period", "Employee", "Designation", "Customer Group", "Target", "Achieved", "Achievement %", "Collection", "Min. Collection", "Commission Type", "Rate", "Commission"],
          rows: rows.map((row, index) => [
            index + 1,
            row.planName,
            `${row.startDate} – ${row.endDate}`,
            row.salesPersonName,
            row.designation,
            row.customerGroupName,
            row.targetAmount,
            row.achieved,
            row.percent.toFixed(2),
            row.collection.toFixed(2),
            row.minimumCollection.toFixed(2),
            COMMISSION_BASIS_LABELS[row.commissionBasis],
            row.commissionRate,
            split ? "" : row.commission.toFixed(2),
          ]),
        }
      : null,
    onExport,
  );

  const columns: Column<PlanReportRow>[] = [
    sl(),
    {
      id: "plan",
      header: "Target Name",
      cell: (row) => (
        <Link href={paths.plan(row.planId)} className="text-ink hover:underline">
          {row.planName}
        </Link>
      ),
      sortValue: (row) => row.planName,
    },
    { id: "period", header: "Period", cell: (row) => `${formatDay(row.startDate)} – ${formatDay(row.endDate)}`, className: "whitespace-nowrap", hideBelow: "lg" },
    { id: "employee", header: "Employee", cell: (row) => row.salesPersonName, sortValue: (row) => row.salesPersonName },
    { id: "designation", header: "Designation", cell: (row) => text(row.designation), hideBelow: "lg" },
    { id: "group", header: "Customer Group", cell: (row) => text(row.customerGroupName), hideBelow: "md" },
    { id: "target", header: "Target", cell: (row) => (row.basis === "QUANTITY" ? formatQty(row.targetAmount) : formatAmount(row.targetAmount)), className: "text-right tabular-nums" },
    { id: "achieved", header: "Achieved", cell: (row) => (row.basis === "QUANTITY" ? formatQty(row.achieved) : formatAmount(row.achieved)), sortValue: (row) => row.achieved, className: "text-right tabular-nums" },
    { id: "percent", header: "Achievement %", cell: (row) => percentCell(row.percent), sortValue: (row) => row.percent, className: "text-right" },
    { id: "collection", header: "Collection", cell: (row) => formatAmount(row.collection), className: "text-right tabular-nums", hideBelow: "md" },
    { id: "minimum", header: "Min. Collection", cell: (row) => formatAmount(row.minimumCollection), className: "text-right tabular-nums", hideBelow: "lg" },
    {
      id: "rate",
      header: "Commission Rate",
      cell: (row) => (row.commissionBasis === "PERCENT" ? `${row.commissionRate}%` : formatAmount(row.commissionRate)),
      className: "text-right tabular-nums",
      hideBelow: "lg",
    },
    {
      id: "commission",
      header: "Commission",
      cell: (row) => (split ? "—" : <span className={cn("tabular-nums", row.earned ? "font-medium text-success" : "text-ink-faint")}>{row.earned ? formatAmount(row.commission) : "Not earned"}</span>),
      sortValue: (row) => row.commission,
      className: "text-right",
    },
  ];

  return (
    <>
      <form onSubmit={view} className="border-b border-line p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField label="Office" required options={offices.map((opt) => (opt.value === "" ? { value: "", label: "Office" } : opt))} value={filters.officeId} onChange={(event) => setFilters({ ...filters, officeId: event.target.value })} />
          <SelectField label="Target Name" options={[{ value: "", label: "Target Name" }, ...(plans.data ?? []).map((plan) => ({ value: plan.id, label: plan.name }))]} value={filters.planId} onChange={(event) => setFilters({ ...filters, planId: event.target.value })} />
          <SelectField label="Employee" options={persons.map((opt) => (opt.value === "" ? { value: "", label: "Select/Search Employee (min 3 letters)" } : opt))} value={filters.salesPersonId} onChange={(event) => setFilters({ ...filters, salesPersonId: event.target.value })} />
          <TextField label="Designation" placeholder="Designation" value={filters.designation} onChange={(event) => setFilters({ ...filters, designation: event.target.value })} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div className="w-48">
            <TextField label="From Date" type="date" required value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
          </div>
          <div className="w-48">
            <TextField label="To Date" type="date" required value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
          </div>
          <div className="pt-5">
            <CheckboxField label="Customer Group" checked={filters.byCustomerGroup} onChange={(event) => setFilters({ ...filters, byCustomerGroup: event.target.checked })} />
          </div>
          <div className="pt-5">
            <Button type="submit" variant="primary" disabled={report.loading}>
              View
            </Button>
          </div>
        </div>
        {filterError && <p className="mt-2 text-xs text-danger">{filterError}</p>}
      </form>
      <Results resource={report}>
        {(data) => (
          <DataTable
            rows={data}
            columns={columns}
            getRowId={(row) => row.key}
            getRowLabel={(row) => `${row.planName} ${row.salesPersonName}`}
            search={{ placeholder: "Search target or employee", match: (row, needle) => `${row.planName} ${row.salesPersonName}`.toLowerCase().includes(needle) }}
            footer={(shown) => ({
              employee: "Total:",
              collection: formatAmount(sum(shown, (row) => row.collection)),
              commission: split ? "—" : formatAmount(sum(shown, (row) => row.commission)),
            })}
            emptyState={<EmptyState title="No Data Found" subtitle="No records found matching the active filter criteria." />}
          />
        )}
      </Results>
    </>
  );
}

// ─── Commission Setup ────────────────────────────────────────────────────────

function CommissionsTab() {
  const list = useResource("commissions", fetchCommissions);
  const [viewing, setViewing] = useState<string | null>(null);
  const removal = useDelete(deleteCommission, list.reload);

  const columns: Column<CommissionRow>[] = [
    sl(),
    { id: "name", header: "Commission Name", cell: (row) => <span className="font-medium text-ink">{row.name}</span>, sortValue: (row) => row.name },
    { id: "employee", header: "Employee", cell: (row) => row.salesPersonName, sortValue: (row) => row.salesPersonName },
    { id: "group", header: "Customer Group", cell: (row) => row.customerGroupName ?? "All customers", hideBelow: "md" },
    { id: "from", header: "From Date", cell: (row) => formatDay(row.fromDate), sortValue: (row) => row.fromDate, className: "whitespace-nowrap" },
    { id: "to", header: "To Date", cell: (row) => formatDay(row.toDate), className: "whitespace-nowrap" },
    { id: "items", header: "Items", cell: (row) => row.items, className: "text-right tabular-nums" },
    { id: "by", header: "Created By", cell: (row) => text(row.createdBy), hideBelow: "lg" },
    {
      id: "actions",
      header: "Action",
      cell: (row) => (
        <span className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" aria-label={`View ${row.name}`} title="View" onClick={() => setViewing(row.id)}>
            <Eye />
          </Button>
          <Link href={paths.editCommission(row.id)} aria-label={`Edit ${row.name}`} title="Edit" className={buttonClasses("ghost", "icon")}>
            <Pencil />
          </Link>
          <Button variant="ghost" size="icon" aria-label={`Delete ${row.name}`} title="Delete" onClick={() => removal.ask(row.id, row.name)}>
            <Trash2 />
          </Button>
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="border-b border-line px-4 py-3">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="radio" checked readOnly className="accent-accent" />
          Item Commission
        </label>
      </div>
      <Results resource={list}>
        {(rows) => (
          <DataTable
            rows={rows}
            columns={columns}
            getRowId={(row) => row.id}
            getRowLabel={(row) => row.name}
            search={{ placeholder: "Search commission or employee", match: (row, needle) => `${row.name} ${row.salesPersonName}`.toLowerCase().includes(needle) }}
            emptyState={<EmptyState title="No Data Found" subtitle="No item commission setups found. Click + Commission Setup to create one." />}
          />
        )}
      </Results>
      {viewing && <CommissionDetailsDialog id={viewing} onClose={() => setViewing(null)} />}
      {removal.dialog}
    </>
  );
}

// ─── Commission Report ───────────────────────────────────────────────────────

function CommissionReportTab({ today, onExport }: { today: string; onExport: (table: TableExport | null) => void }) {
  const { offices, setup } = useFilterLookups();
  const initial = { viewBy: "EMPLOYEE", officeId: "", categoryId: "", from: addDays(today, -30), to: today, summary: false };
  const [filters, setFilters] = useState(initial);
  const toQuery = (values: typeof initial) =>
    Object.fromEntries(Object.entries({ ...values, summary: values.summary ? "true" : "" }).filter(([, value]) => value)) as CommissionReportQuery;
  const [query, setQuery] = useState<CommissionReportQuery>(toQuery(initial));
  const [filterError, setFilterError] = useState<string>();
  const report = useResource(`commission-report:${JSON.stringify(query)}`, () => fetchCommissionReport(query));
  const summary = query.summary === "true";
  const byItem = query.viewBy === "ITEM";

  function view(event: FormEvent) {
    event.preventDefault();
    const next = toQuery(filters);
    const parsed = commissionReportQuerySchema.safeParse(next);
    if (!parsed.success) return setFilterError(parsed.error.issues[0]?.message);
    setFilterError(undefined);
    if (JSON.stringify(next) === JSON.stringify(query)) report.reload();
    else setQuery(next);
  }

  const data = report.data;
  useTableExport(
    data
      ? summary
        ? {
            name: "commission-summary",
            title: `Commission Summary by ${byItem ? "Item" : "Employee"} ${formatDay(query.from)} – ${formatDay(query.to)}`,
            headers: ["SL", byItem ? "Item" : "Employee", "Quantity", "Sales Amount", "Commission"],
            rows: data.summary.map((row, index) => [index + 1, row.name, row.qty, row.amount.toFixed(2), row.commission.toFixed(2)]),
          }
        : {
            name: "commission-report",
            title: `Commission Report ${formatDay(query.from)} – ${formatDay(query.to)}`,
            headers: ["SL", "Date", "Invoice", "Employee", "Customer", "Item", "Quantity", "Sales Amount", "Type", "Rate", "Commission", "Setup"],
            rows: data.lines.map((row, index) => [
              index + 1,
              row.deliveryDate,
              row.invoiceNumber,
              row.salesPersonName,
              row.customerName,
              `${row.itemCode} - ${row.itemName}`,
              row.qty,
              row.amount.toFixed(2),
              COMMISSION_BASIS_LABELS[row.basis],
              row.rate,
              row.commission.toFixed(2),
              row.commissionName,
            ]),
          }
      : null,
    onExport,
  );

  const lineColumns: Column<CommissionReportLine>[] = [
    sl(),
    { id: "date", header: "Date", cell: (row) => formatDay(row.deliveryDate), sortValue: (row) => row.deliveryDate, className: "whitespace-nowrap" },
    {
      id: "invoice",
      header: "Invoice",
      cell: (row) => (
        <Link href={paths.delivery(row.deliveryId)} className="whitespace-nowrap text-ink hover:underline">
          {row.invoiceNumber}
        </Link>
      ),
    },
    { id: "employee", header: "Employee", cell: (row) => row.salesPersonName, sortValue: (row) => row.salesPersonName },
    { id: "customer", header: "Customer", cell: (row) => row.customerName, hideBelow: "lg" },
    { id: "item", header: "Item", cell: (row) => row.itemName, sortValue: (row) => row.itemName },
    { id: "qty", header: "Quantity", cell: (row) => formatQty(row.qty), className: "text-right tabular-nums" },
    { id: "amount", header: "Sales Amount", cell: (row) => formatAmount(row.amount), className: "text-right tabular-nums", hideBelow: "md" },
    { id: "rate", header: "Rate", cell: (row) => (row.basis === "PERCENT" ? `${row.rate}%` : `${formatAmount(row.rate)} / unit`), className: "text-right tabular-nums whitespace-nowrap", hideBelow: "md" },
    { id: "commission", header: "Commission", cell: (row) => formatAmount(row.commission), sortValue: (row) => row.commission, className: "text-right tabular-nums" },
  ];
  const summaryColumns: Column<CommissionSummaryRow>[] = [
    sl(),
    { id: "name", header: byItem ? "Item" : "Employee", cell: (row) => row.name, sortValue: (row) => row.name },
    { id: "qty", header: "Quantity", cell: (row) => formatQty(row.qty), className: "text-right tabular-nums" },
    { id: "amount", header: "Sales Amount", cell: (row) => formatAmount(row.amount), className: "text-right tabular-nums" },
    { id: "commission", header: "Commission", cell: (row) => formatAmount(row.commission), sortValue: (row) => row.commission, className: "text-right tabular-nums" },
  ];
  const categories = (setup.data?.categories ?? []).map((category) => ({ value: category.id, label: `${category.name} (${CATEGORY_LEVEL_LABELS[category.level]})` }));

  return (
    <>
      <form onSubmit={view} className="border-b border-line p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48">
            <SelectField label="View By" required options={[{ value: "", label: "Select View By" }, { value: "EMPLOYEE", label: "Employee" }, { value: "ITEM", label: "Item" }]} value={filters.viewBy} onChange={(event) => setFilters({ ...filters, viewBy: event.target.value })} />
          </div>
          <div className="w-48">
            <SelectField label="Office" options={offices.map((opt) => (opt.value === "" ? { value: "", label: "Select Office" } : opt))} value={filters.officeId} onChange={(event) => setFilters({ ...filters, officeId: event.target.value })} />
          </div>
          <div className="w-56">
            <SelectField label="Item Category" options={[{ value: "", label: "Select Item Category" }, ...categories.filter((c) => c.value !== "")]} value={filters.categoryId} onChange={(event) => setFilters({ ...filters, categoryId: event.target.value })} />
          </div>
          <div className="w-44">
            <TextField label="From Date" type="date" required value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
          </div>
          <div className="w-44">
            <TextField label="To Date" type="date" required value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
          </div>
          <div className="pb-1.5">
            <CheckboxField label="Summary" checked={filters.summary} onChange={(event) => setFilters({ ...filters, summary: event.target.checked })} />
          </div>
          <div className="pb-1">
            <Button type="submit" variant="primary" disabled={report.loading}>
              View
            </Button>
          </div>
        </div>
        {filterError && <p className="mt-2 text-xs text-danger">{filterError}</p>}
      </form>
      <Results resource={report}>
        {(result) =>
          summary ? (
            <DataTable
              rows={result.summary}
              columns={summaryColumns}
              getRowId={(row) => row.key}
              getRowLabel={(row) => row.name}
              footer={(shown) => ({ name: "Total:", amount: formatAmount(sum(shown, (row) => row.amount)), commission: formatAmount(sum(shown, (row) => row.commission)) })}
              emptyState={<EmptyState title="No Data Found" subtitle="No records found matching the active filter criteria." />}
            />
          ) : (
            <DataTable
              rows={result.lines}
              columns={lineColumns}
              getRowId={(row) => row.key}
              getRowLabel={(row) => `${row.invoiceNumber} ${row.itemName}`}
              search={{ placeholder: "Search invoice, employee, item", match: (row, needle) => `${row.invoiceNumber} ${row.salesPersonName} ${row.itemName} ${row.customerName}`.toLowerCase().includes(needle) }}
              footer={(shown) => ({ item: "Total:", amount: formatAmount(sum(shown, (row) => row.amount)), commission: formatAmount(sum(shown, (row) => row.commission)) })}
              emptyState={<EmptyState title="No Data Found" subtitle="No records found matching the active filter criteria." />}
            />
          )
        }
      </Results>
    </>
  );
}
