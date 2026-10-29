"use client";

import { Download, Eye, FileText, Pencil, Plus, Printer, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { CONTROL, SelectField, TextField } from "@/components/ui/form-field";
import { type IndicatorColor } from "@/components/ui/indicator";
import { Card, EmptyState, ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { SearchPick } from "../../components/SearchPick";
import { formatAmount, formatQty } from "../../dashboard/lib/format";
import { DayCell, FilterForm, useDebounced, useFilterLookups } from "../../deliveries/components/DeliveryWorkspaceView";
import { DELIVERY_TYPE_LABELS } from "../../deliveries/schemas/delivery.schema";
import { addDays, useToday } from "../../lib/use-today";
import { paths } from "../../paths";
import {
  MARKET_STAGE_LABELS,
  RETURN_KIND_LABELS,
  RETURN_MODES,
  RETURN_MODE_LABELS,
  RETURN_PAGE_SIZES,
  RETURN_STATUSES,
  RETURN_STATUS_LABELS,
  returnableDeliveryQuerySchema,
  returnListQuerySchema,
  type MarketStage,
  type ReturnableDeliveryQuery,
  type ReturnableDeliveryRow,
  type ReturnListQuery,
  type ReturnListRow,
  type ReturnMode,
  type ReturnStatus,
} from "../schemas/return.schema";
import { downloadReturnExcel, fetchReturnableDeliveries, fetchReturns, returnChallanPdfUrl } from "../services/return.api";

type Tab = "deliveries" | "returns" | "market";
const TABS: { id: Tab; label: string }[] = [
  { id: "deliveries", label: "Delivery List" },
  { id: "returns", label: "Return List" },
  { id: "market", label: "Market Return" },
];
const isTab = (value: string | null): value is Tab => TABS.some((tab) => tab.id === value);

const all = { value: "", label: "All" };
const text = (value: string | null) => value ?? "N/A";
type Query = Record<string, unknown>;

export const STATUS_COLORS: Record<ReturnStatus, IndicatorColor> = { DRAFT: "orange", SUBMITTED: "green", CANCELLED: "red" };
export const STAGE_COLORS: Record<MarketStage, IndicatorColor> = {
  PENDING: "orange",
  APPROVED: "blue",
  FACTORY_RECEIVED: "purple",
  QC_DONE: "green",
  DELETED: "red",
};
export const MODE_COLORS: Record<ReturnMode, IndicatorColor> = { FULL: "red", PARTIAL: "orange", WITHOUT_REFERENCE: "yellow", EXCHANGE: "blue" };

const STATUS_TEXT: Record<ReturnStatus, string> = { DRAFT: "text-warning", SUBMITTED: "text-success", CANCELLED: "text-danger" };
const STAGE_TEXT: Record<MarketStage, string> = {
  PENDING: "text-warning",
  APPROVED: "text-accent-strong",
  FACTORY_RECEIVED: "text-accent-strong",
  QC_DONE: "text-success",
  DELETED: "text-danger",
};

/** Tells the page head the query in use (for Excel), whenever it changes. */
function useReportQuery(query: Query, onQuery: (query: Query | null) => void) {
  const key = JSON.stringify(query);
  useEffect(() => {
    onQuery(JSON.parse(key) as Query);
    return () => onQuery(null);
  }, [key, onQuery]);
}

/** /sales/returns?tab=… — read the tab inside <Suspense> (search params are request-time). */
export function ReturnWorkspaceView() {
  const today = useToday();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const tab: Tab = isTab(params.get("tab")) ? (params.get("tab") as Tab) : "deliveries";
  const [search, setSearch] = useState("");
  const searched = useDebounced(search.trim());
  const [exportQuery, setExportQuery] = useState<Query | null>(null);
  const [exporting, setExporting] = useState(false);

  async function exportExcel() {
    if (!exportQuery) return;
    setExporting(true);
    try {
      await downloadReturnExcel(tab, exportQuery);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setExporting(false);
    }
  }

  return (
    <PageContainer className="max-w-none">
      <PageHead
        title="Sales Return"
        actions={
          <>
            <label className="relative w-56">
              <span className="sr-only">Search</span>
              <Search aria-hidden="true" className="pointer-events-none absolute top-1.5 left-2 size-4 text-ink-faint" />
              <input type="search" value={search} placeholder="Search…" onChange={(event) => setSearch(event.target.value)} className={cn(CONTROL, "h-7 pl-7")} />
            </label>
            <Button onClick={exportExcel} loading={exporting} disabled={!exportQuery}>
              <Download aria-hidden="true" />
              Excel
            </Button>
            <Link href={paths.newReturn} className={buttonClasses("primary")}>
              <Plus aria-hidden="true" />
              Return Without Ref.
            </Link>
          </>
        }
      />
      <Card>
        <Tabs<Tab> label="Return lists" tabs={TABS} value={tab} onChange={(next) => router.replace(`${pathname}?tab=${next}`)}>
          {!today ? (
            <LoadingState />
          ) : tab === "deliveries" ? (
            <DeliveriesTab key="deliveries" today={today} search={searched} onQuery={setExportQuery} />
          ) : (
            <ReturnsTab key={tab} market={tab === "market"} today={today} search={searched} onQuery={setExportQuery} />
          )}
        </Tabs>
      </Card>
    </PageContainer>
  );
}

// ─── Delivery List: deliveries that can be returned ─────────────────────────

function DeliveriesTab({ today, search, onQuery }: { today: string; search: string; onQuery: (query: Query | null) => void }) {
  const [filters, setFilters] = useState({ from: addDays(today, -30), to: today });
  const [query, setQuery] = useState<ReturnableDeliveryQuery>(filters);
  const [filterError, setFilterError] = useState<string>();
  const effective: ReturnableDeliveryQuery = { ...query, ...(search ? { search } : {}) };
  const list = useResource(`returnable:${JSON.stringify(effective)}`, () => fetchReturnableDeliveries(effective));
  useReportQuery(effective, onQuery);

  function view(event: FormEvent) {
    event.preventDefault();
    const parsed = returnableDeliveryQuerySchema.safeParse(filters);
    if (!parsed.success) return setFilterError(parsed.error.issues[0]?.message);
    setFilterError(undefined);
    if (JSON.stringify(filters) === JSON.stringify(query)) list.reload();
    else setQuery(filters);
  }

  const rows = list.data;
  const columns: Column<ReturnableDeliveryRow>[] = [
    { id: "sl", header: "SL", cell: (_row, index) => <span className="tabular-nums">{index + 1}</span>, className: "w-10" },
    { id: "date", header: "Delivery Date", cell: (row) => <DayCell day={row.deliveryDate} />, sortValue: (row) => row.deliveryDate, className: "whitespace-nowrap" },
    {
      id: "invoice",
      header: "Invoice No",
      cell: (row) => (
        <Link href={paths.delivery(row.id)} className="whitespace-nowrap text-ink hover:underline">
          {row.number}
        </Link>
      ),
      sortValue: (row) => row.number,
    },
    { id: "so", header: "SO No", cell: (row) => <span className="whitespace-nowrap">{text(row.orderNumber)}</span>, hideBelow: "md" },
    { id: "challan", header: "Challan No", cell: (row) => <span className="whitespace-nowrap">{text(row.challanNo)}</span>, hideBelow: "lg" },
    { id: "code", header: "Customer Code", cell: (row) => row.customerCode, hideBelow: "lg" },
    { id: "customer", header: "Customer", cell: (row) => <span className="line-clamp-1 max-w-48">{row.customerName}</span>, sortValue: (row) => row.customerName },
    { id: "delivered", header: "Deli. QTY", cell: (row) => formatQty(row.deliveredQty), className: "text-right tabular-nums" },
    {
      id: "returned",
      header: "Ret. QTY",
      cell: (row) => <span className={row.returnedQty > 0 ? "text-danger" : undefined}>{formatQty(row.returnedQty)}</span>,
      className: "text-right tabular-nums",
      sortValue: (row) => row.returnedQty,
    },
    { id: "amount", header: "Item Total", cell: (row) => formatAmount(row.totalAmount), className: "text-right tabular-nums", sortValue: (row) => row.totalAmount },
    { id: "by", header: "Sales By", cell: (row) => <span className="line-clamp-1 max-w-32">{text(row.salesPersonName)}</span>, hideBelow: "md" },
    { id: "type", header: "Status", cell: (row) => <span className="text-success">{DELIVERY_TYPE_LABELS[row.deliveryType]}</span>, hideBelow: "lg" },
    {
      id: "return",
      header: "Return",
      cell: (row) => {
        const left = row.deliveredQty - row.returnedQty > 1e-9;
        if (!left) return <span className="text-xs text-ink-faint">Returned</span>;
        return (
          <span className="flex items-center gap-2 whitespace-nowrap text-xs">
            {row.returnedQty === 0 && (
              <Link href={paths.returnDelivery(row.id, "full")} className="text-accent-strong underline underline-offset-2">
                Full
              </Link>
            )}
            <Link href={paths.returnDelivery(row.id, "partial")} className="text-accent-strong underline underline-offset-2">
              Partial
            </Link>
          </span>
        );
      },
    },
  ];

  return (
    <>
      <FilterForm onSubmit={view} error={filterError} loading={list.loading}>
        <TextField label="From Date" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
        <TextField label="To Date" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
      </FilterForm>
      {list.error ? (
        <ErrorState message={errorMessage(list.error)} onRetry={list.reload} />
      ) : !rows ? (
        <LoadingState />
      ) : (
        <div aria-busy={list.loading} className={list.loading ? "opacity-60 transition-opacity" : undefined}>
          <DataTable rows={rows} columns={columns} getRowId={(row) => row.id} getRowLabel={(row) => row.number} emptyState={<EmptyState title="No deliveries in this range" />} />
        </div>
      )}
    </>
  );
}

// ─── Return List / Market Return ─────────────────────────────────────────────

type ListFilters = Record<"customerGroupId" | "territoryId" | "salesPersonId" | "mode" | "status" | "from" | "to", string>;

function ReturnsTab({ market, today, search, onQuery }: { market: boolean; today: string; search: string; onQuery: (query: Query | null) => void }) {
  const filterLists = useFilterLookups();
  const initial: ListFilters = {
    customerGroupId: "",
    territoryId: "",
    salesPersonId: "",
    mode: "",
    status: "",
    from: addDays(today, market ? 0 : -30),
    to: today,
  };
  const [filters, setFilters] = useState(initial);
  const toQuery = (values: ListFilters): ReturnListQuery =>
    ({ ...Object.fromEntries(Object.entries(values).filter(([, value]) => value)), ...(market ? { kind: "MARKET" } : {}) }) as ReturnListQuery;
  const [query, setQuery] = useState<ReturnListQuery>(toQuery(initial));
  const [paging, setPaging] = useState({ page: 1, pageSize: 50 });
  const [filterError, setFilterError] = useState<string>();
  const filtered: ReturnListQuery = { ...query, ...(search ? { search } : {}) };
  const list = useResource(`returns:${JSON.stringify(filtered)}:${paging.page}:${paging.pageSize}`, () => fetchReturns({ ...filtered, ...paging }));
  // Excel exports every matching return, not just this page.
  useReportQuery(filtered, onQuery);
  const [searchedFor, setSearchedFor] = useState(search);
  if (searchedFor !== search) {
    setSearchedFor(search);
    setPaging((current) => ({ ...current, page: 1 }));
  }

  const field = (key: keyof ListFilters) => ({
    value: filters[key],
    onChange: (event: { target: { value: string } }) => setFilters({ ...filters, [key]: event.target.value }),
  });

  function view(event: FormEvent) {
    event.preventDefault();
    const next = toQuery(filters);
    const parsed = returnListQuerySchema.safeParse(next);
    if (!parsed.success) return setFilterError(parsed.error.issues[0]?.message);
    setFilterError(undefined);
    setPaging((current) => ({ ...current, page: 1 }));
    if (JSON.stringify(next) === JSON.stringify(query)) list.reload();
    else setQuery(next);
  }

  const data = list.data;
  const offset = (paging.page - 1) * paging.pageSize;
  const status = (row: ReturnListRow) =>
    row.kind === "MARKET" && row.status === "SUBMITTED" ? (
      <span className={cn("font-medium", STAGE_TEXT[row.marketStage])}>{MARKET_STAGE_LABELS[row.marketStage]}</span>
    ) : (
      <span className={cn("font-medium", STATUS_TEXT[row.status])}>{RETURN_STATUS_LABELS[row.status]}</span>
    );

  const sl: Column<ReturnListRow> = { id: "sl", header: "SL", cell: (_row, index) => <span className="tabular-nums">{offset + index + 1}</span>, className: "w-10" };
  const actions: Column<ReturnListRow> = {
    id: "actions",
    header: "Action",
    cell: (row) => {
      const editable = row.status === "DRAFT" && row.mode !== "EXCHANGE";
      return (
        <span className="flex items-center gap-0.5">
          <Link href={paths.printReturn(row.id)} aria-label={`Print ${row.number}`} title="Print" className={buttonClasses("ghost", "icon")}>
            <Printer />
          </Link>
          <Link href={paths.salesReturn(row.id)} aria-label={`View ${row.number}`} title="View" className={buttonClasses("ghost", "icon")}>
            <Eye />
          </Link>
          {editable ? (
            <Link href={paths.editReturn(row.id)} aria-label={`Edit ${row.number}`} title="Edit" className={buttonClasses("ghost", "icon")}>
              <Pencil />
            </Link>
          ) : (
            <span aria-hidden="true" title="Only pending returns can be edited" className={cn(buttonClasses("ghost", "icon"), "opacity-30")}>
              <Pencil />
            </span>
          )}
          <a href={returnChallanPdfUrl(row.id)} target="_blank" rel="noopener" aria-label={`Return challan of ${row.number}`} title="Return Note/Challan (PDF)" className={buttonClasses("ghost", "icon")}>
            <FileText />
          </a>
        </span>
      );
    },
  };
  const date: Column<ReturnListRow> = { id: "date", header: "Return Date", cell: (row) => <DayCell day={row.returnDate} />, sortValue: (row) => row.returnDate, className: "whitespace-nowrap" };
  const number = (header: string): Column<ReturnListRow> => ({
    id: "number",
    header,
    cell: (row) => (
      <Link href={paths.salesReturn(row.id)} className="whitespace-nowrap text-ink hover:underline">
        {row.number}
      </Link>
    ),
    sortValue: (row) => row.number,
  });
  const mode: Column<ReturnListRow> = { id: "mode", header: "Return Type", cell: (row) => <span className="font-medium text-warning">{RETURN_MODE_LABELS[row.mode]}</span> };

  const columns: Column<ReturnListRow>[] = market
    ? [
        sl,
        date,
        number("Return No"),
        mode,
        { id: "qty", header: "Total Return Quantity", cell: (row) => formatQty(row.totalQty), className: "text-right tabular-nums" },
        { id: "received", header: "Total Factory Rec. Quantity", cell: (row) => formatQty(row.receivedQty), className: "text-right tabular-nums" },
        { id: "qc", header: "Total QC Quantity", cell: (row) => formatQty(row.qcQty), className: "text-right tabular-nums" },
        { id: "status", header: "Status", cell: status },
        actions,
      ]
    : [
        sl,
        date,
        number("Invoice No"),
        {
          id: "delivery",
          header: "Delivery No",
          cell: (row) =>
            row.deliveryId ? (
              <Link href={paths.delivery(row.deliveryId)} className="whitespace-nowrap text-ink hover:underline">
                {row.deliveryNumber}
              </Link>
            ) : (
              ""
            ),
          hideBelow: "md",
        },
        { id: "code", header: "Customer Code", cell: (row) => row.customerCode, hideBelow: "lg" },
        { id: "customer", header: "Customer", cell: (row) => <span className="line-clamp-2 min-w-36">{row.customerName}</span>, sortValue: (row) => row.customerName },
        { id: "outlet", header: "Project/Outlet/Ref", cell: (row) => text(row.refProjectOutlet), hideBelow: "lg" },
        { id: "ref", header: "Return Ref. No", cell: (row) => text(row.refNo), hideBelow: "lg" },
        { id: "req", header: "Return Req. No", cell: (row) => text(row.requestNo), hideBelow: "lg" },
        { id: "qty", header: "Return Qty", cell: (row) => formatQty(row.totalQty), className: "text-right tabular-nums", sortValue: (row) => row.totalQty },
        { id: "amount", header: "Return Amount", cell: (row) => formatAmount(-row.totalAmount), className: "text-right tabular-nums", sortValue: (row) => row.totalAmount },
        mode,
        { id: "by", header: "Sales By", cell: (row) => <span className="line-clamp-3 min-w-32">{text(row.salesPersonName)}</span>, hideBelow: "md" },
        { id: "territory", header: "Territory", cell: (row) => text(row.territory), hideBelow: "lg" },
        { id: "kind", header: "Type", cell: (row) => RETURN_KIND_LABELS[row.kind], hideBelow: "lg" },
        { id: "status", header: "Status", cell: status, sortValue: (row) => row.status },
        actions,
      ];

  const persons = filterLists.setup.data?.salesPersons ?? [];
  return (
    <>
      <FilterForm onSubmit={view} error={filterError} loading={list.loading}>
        {!market && <SelectField label="Customer Group" options={filterLists.groups} {...field("customerGroupId")} />}
        {!market && <SelectField label="Territory" options={filterLists.areaOptions("TERRITORY")} {...field("territoryId")} />}
        {!market && (
          <SearchPick
            key={persons.length}
            label="Sales Force"
            placeholder="Select/Search Sales Force (min 3 letters)"
            options={persons.map((person) => ({ id: person.id, label: person.name }))}
            selectedId={filters.salesPersonId}
            onPick={(id) => setFilters((current) => ({ ...current, salesPersonId: id ?? "" }))}
          />
        )}
        {!market && <SelectField label="Return Type" options={[all, ...RETURN_MODES.map((value) => ({ value, label: RETURN_MODE_LABELS[value] }))]} {...field("mode")} />}
        {!market && <SelectField label="Status" options={[all, ...RETURN_STATUSES.map((value) => ({ value, label: RETURN_STATUS_LABELS[value] }))]} {...field("status")} />}
        <TextField label="From Date" type="date" {...field("from")} />
        <TextField label="To Date" type="date" {...field("to")} />
      </FilterForm>
      {list.error ? (
        <ErrorState message={errorMessage(list.error)} onRetry={list.reload} />
      ) : !data ? (
        <LoadingState />
      ) : (
        <div aria-busy={list.loading} className={list.loading ? "opacity-60 transition-opacity" : undefined}>
          <DataTable
            rows={data.rows}
            columns={columns}
            getRowId={(row) => row.id}
            getRowLabel={(row) => row.number}
            rowHref={(row) => paths.salesReturn(row.id)}
            footer={(rows) =>
              market
                ? { mode: "Total:", qty: formatQty(rows.reduce((sum, row) => sum + row.totalQty, 0)) }
                : {
                    customer: "Total:",
                    qty: formatQty(rows.reduce((sum, row) => sum + row.totalQty, 0)),
                    amount: formatAmount(-rows.reduce((sum, row) => sum + row.totalAmount, 0)),
                  }
            }
            serverPage={{
              page: paging.page,
              pageSize: paging.pageSize,
              total: data.totalCount,
              sizes: RETURN_PAGE_SIZES,
              onChange: (page, pageSize) => setPaging({ page, pageSize }),
            }}
            emptyState={<EmptyState title="No Data Found" />}
          />
        </div>
      )}
    </>
  );
}
