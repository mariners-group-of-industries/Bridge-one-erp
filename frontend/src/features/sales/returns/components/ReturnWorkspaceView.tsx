"use client";

import { Download, Eye, Pencil, Plus, Printer } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SelectField, TextField } from "@/components/ui/form-field";
import { Indicator, type IndicatorColor } from "@/components/ui/indicator";
import { Card, EmptyState, ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { formatAmount, formatQty } from "../../dashboard/lib/format";
import { FilterForm, useExport, useFilterLookups } from "../../deliveries/components/DeliveryWorkspaceView";
import { DELIVERY_TYPE_LABELS } from "../../deliveries/schemas/delivery.schema";
import { downloadCsv } from "../../lib/csv";
import { addDays, formatDay, useToday } from "../../lib/use-today";
import { paths } from "../../paths";
import {
  MARKET_STAGE_LABELS,
  RETURN_KIND_LABELS,
  RETURN_MODES,
  RETURN_MODE_LABELS,
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
import { fetchReturnableDeliveries, fetchReturns } from "../services/return.api";

type Tab = "deliveries" | "returns" | "market";
const TABS: { id: Tab; label: string }[] = [
  { id: "deliveries", label: "Delivery List" },
  { id: "returns", label: "Return List" },
  { id: "market", label: "Market Return" },
];
const isTab = (value: string | null): value is Tab => TABS.some((tab) => tab.id === value);

const all = { value: "", label: "All" };
const text = (value: string | null) => value ?? "N/A";

export const STATUS_COLORS: Record<ReturnStatus, IndicatorColor> = { DRAFT: "orange", SUBMITTED: "green", CANCELLED: "red" };
export const STAGE_COLORS: Record<MarketStage, IndicatorColor> = {
  PENDING: "orange",
  APPROVED: "blue",
  FACTORY_RECEIVED: "purple",
  QC_DONE: "green",
  DELETED: "red",
};
export const MODE_COLORS: Record<ReturnMode, IndicatorColor> = { FULL: "red", PARTIAL: "orange", WITHOUT_REFERENCE: "yellow", EXCHANGE: "blue" };

/** /sales/returns?tab=… — read the tab inside <Suspense> (search params are request-time). */
export function ReturnWorkspaceView() {
  const today = useToday();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab: Tab = isTab(params.get("tab")) ? (params.get("tab") as Tab) : "deliveries";
  const [exportRows, setExportRows] = useState<(() => void) | null>(null);

  return (
    <PageContainer className="max-w-none">
      <PageHead
        title="Sales Return"
        actions={
          <>
            <Button onClick={() => exportRows?.()} disabled={!exportRows}>
              <Download aria-hidden="true" />
              Excel (CSV)
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
            <DeliveriesTab key="deliveries" today={today} onExport={setExportRows} />
          ) : (
            <ReturnsTab key={tab} market={tab === "market"} today={today} onExport={setExportRows} />
          )}
        </Tabs>
      </Card>
    </PageContainer>
  );
}

// ─── Delivery List: deliveries that can be returned ─────────────────────────

function DeliveriesTab({ today, onExport }: { today: string; onExport: (fn: (() => void) | null) => void }) {
  const filterLists = useFilterLookups();
  const [filters, setFilters] = useState({ officeId: "", from: addDays(today, -30), to: today });
  const toQuery = (values: typeof filters): ReturnableDeliveryQuery =>
    Object.fromEntries(Object.entries(values).filter(([, value]) => value)) as ReturnableDeliveryQuery;
  const [query, setQuery] = useState<ReturnableDeliveryQuery>(toQuery(filters));
  const [filterError, setFilterError] = useState<string>();
  const list = useResource(`returnable:${JSON.stringify(query)}`, () => fetchReturnableDeliveries(query));

  function view(event: FormEvent) {
    event.preventDefault();
    const next = toQuery(filters);
    const parsed = returnableDeliveryQuerySchema.safeParse(next);
    if (!parsed.success) return setFilterError(parsed.error.issues[0]?.message);
    setFilterError(undefined);
    if (JSON.stringify(next) === JSON.stringify(query)) list.reload();
    else setQuery(next);
  }

  const rows = list.data;
  useExport(
    rows
      ? () =>
          downloadCsv(
            `returnable-deliveries-${today}.csv`,
            ["Delivery Date", "Invoice No", "SO No", "Challan No", "Customer Code", "Customer", "Delivered Qty", "Returned Qty", "Invoice Amount", "Sales By", "Type"],
            rows.map((row) => [
              row.deliveryDate,
              row.number,
              row.orderNumber,
              row.challanNo,
              row.customerCode,
              row.customerName,
              row.deliveredQty,
              row.returnedQty,
              row.totalAmount.toFixed(2),
              row.salesPersonName,
              DELIVERY_TYPE_LABELS[row.deliveryType],
            ]),
          )
      : null,
    onExport,
  );

  const columns: Column<ReturnableDeliveryRow>[] = [
    { id: "date", header: "Delivery Date", cell: (row) => formatDay(row.deliveryDate), sortValue: (row) => row.deliveryDate, className: "whitespace-nowrap" },
    {
      id: "invoice",
      header: "Invoice No",
      cell: (row) => (
        <Link href={paths.delivery(row.id)} className="font-medium whitespace-nowrap text-ink hover:underline">
          {row.number}
        </Link>
      ),
      sortValue: (row) => row.number,
    },
    { id: "so", header: "SO No", cell: (row) => <span className="whitespace-nowrap">{text(row.orderNumber)}</span>, hideBelow: "md" },
    { id: "challan", header: "Challan No", cell: (row) => <span className="whitespace-nowrap">{text(row.challanNo)}</span>, hideBelow: "lg" },
    { id: "code", header: "Customer Code", cell: (row) => row.customerCode, hideBelow: "lg" },
    { id: "customer", header: "Customer", cell: (row) => row.customerName, sortValue: (row) => row.customerName },
    { id: "delivered", header: "Deli. Qty", cell: (row) => formatQty(row.deliveredQty), className: "text-right tabular-nums" },
    {
      id: "returned",
      header: "Ret. Qty",
      cell: (row) => <span className={row.returnedQty > 0 ? "text-danger" : undefined}>{formatQty(row.returnedQty)}</span>,
      className: "text-right tabular-nums",
      sortValue: (row) => row.returnedQty,
    },
    { id: "amount", header: "Invoice Amount", cell: (row) => formatAmount(row.totalAmount), className: "text-right tabular-nums", sortValue: (row) => row.totalAmount },
    { id: "by", header: "Sales By", cell: (row) => text(row.salesPersonName), hideBelow: "md" },
    { id: "type", header: "Status", cell: (row) => <span className="text-success">{DELIVERY_TYPE_LABELS[row.deliveryType]}</span>, hideBelow: "lg" },
    {
      id: "return",
      header: "Return",
      cell: (row) => {
        const left = row.deliveredQty - row.returnedQty > 1e-9;
        if (!left) return <span className="text-xs text-ink-faint">Returned</span>;
        return (
          <span className="flex items-center gap-2 whitespace-nowrap">
            {row.returnedQty === 0 && (
              <Link href={paths.returnDelivery(row.id, "full")} className="text-sm text-ink underline underline-offset-2 hover:text-danger">
                Full
              </Link>
            )}
            <Link href={paths.returnDelivery(row.id, "partial")} className="text-sm text-ink underline underline-offset-2 hover:text-warning">
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
        <SelectField label="Office" options={filterLists.offices} value={filters.officeId} onChange={(event) => setFilters({ ...filters, officeId: event.target.value })} />
        <TextField label="From Date" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
        <TextField label="To Date" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
      </FilterForm>
      {list.error ? (
        <ErrorState message={errorMessage(list.error)} onRetry={list.reload} />
      ) : !rows ? (
        <LoadingState />
      ) : (
        <div aria-busy={list.loading} className={list.loading ? "opacity-60 transition-opacity" : undefined}>
          <DataTable
            rows={rows}
            columns={columns}
            getRowId={(row) => row.id}
            getRowLabel={(row) => row.number}
            search={{
              placeholder: "Search invoice, challan, SO, customer",
              match: (row, needle) => `${row.number} ${row.challanNo ?? ""} ${row.orderNumber ?? ""} ${row.customerName} ${row.customerCode}`.toLowerCase().includes(needle),
            }}
            emptyState={<EmptyState title="No deliveries in this range" />}
          />
        </div>
      )}
    </>
  );
}

// ─── Return List / Market Return ─────────────────────────────────────────────

type ListFilters = Record<"officeId" | "customerGroupId" | "territoryId" | "salesPersonId" | "mode" | "status" | "from" | "to", string>;

function ReturnsTab({ market, today, onExport }: { market: boolean; today: string; onExport: (fn: (() => void) | null) => void }) {
  const filterLists = useFilterLookups();
  const initial: ListFilters = {
    officeId: "",
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
  const [filterError, setFilterError] = useState<string>();
  const list = useResource(`returns:${JSON.stringify(query)}`, () => fetchReturns(query));

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
    if (JSON.stringify(next) === JSON.stringify(query)) list.reload();
    else setQuery(next);
  }

  const data = list.data;
  useExport(
    data
      ? () =>
          downloadCsv(
            `${market ? "market-returns" : "returns"}-${today}.csv`,
            ["Return Date", "Return No", "Delivery No", "Office", "Customer Code", "Customer", "Project/Outlet/Ref", "Return Ref. No", "Return Req. No", "Return Qty", "Factory Rec. Qty", "QC Qty", "Return Amount", "Return Type", "Sales By", "Territory", "Type", "Status"],
            data.rows.map((row) => [
              row.returnDate,
              row.number,
              row.deliveryNumber,
              row.officeName,
              row.customerCode,
              row.customerName,
              row.refProjectOutlet,
              row.refNo,
              row.requestNo,
              row.totalQty,
              row.kind === "MARKET" ? row.receivedQty : "",
              row.kind === "MARKET" ? row.qcQty : "",
              row.totalAmount.toFixed(2),
              RETURN_MODE_LABELS[row.mode],
              row.salesPersonName,
              row.territory,
              RETURN_KIND_LABELS[row.kind],
              row.kind === "MARKET" ? MARKET_STAGE_LABELS[row.marketStage] : RETURN_STATUS_LABELS[row.status],
            ]),
          )
      : null,
    onExport,
  );

  const actions: Column<ReturnListRow> = {
    id: "actions",
    header: "Action",
    cell: (row) => (
      <span className="flex items-center gap-0.5">
        <Link href={paths.salesReturn(row.id)} aria-label={`View ${row.number}`} title="View" className={buttonClasses("ghost", "icon")}>
          <Eye />
        </Link>
        {row.status === "DRAFT" && row.mode !== "EXCHANGE" && (
          <Link href={paths.editReturn(row.id)} aria-label={`Edit ${row.number}`} title="Edit" className={buttonClasses("ghost", "icon")}>
            <Pencil />
          </Link>
        )}
        <Link href={paths.printReturn(row.id)} aria-label={`Print ${row.number}`} title="Print" className={buttonClasses("ghost", "icon")}>
          <Printer />
        </Link>
      </span>
    ),
  };
  const number: Column<ReturnListRow> = {
    id: "number",
    header: "Return No",
    cell: (row) => (
      <Link href={paths.salesReturn(row.id)} className="font-medium whitespace-nowrap text-ink hover:underline">
        {row.number}
      </Link>
    ),
    sortValue: (row) => row.number,
  };
  const date: Column<ReturnListRow> = { id: "date", header: "Return Date", cell: (row) => formatDay(row.returnDate), sortValue: (row) => row.returnDate, className: "whitespace-nowrap" };
  const mode: Column<ReturnListRow> = { id: "mode", header: "Return Type", cell: (row) => <Indicator color={MODE_COLORS[row.mode]}>{RETURN_MODE_LABELS[row.mode]}</Indicator> };
  const qty: Column<ReturnListRow> = { id: "qty", header: market ? "Total Return Qty" : "Return Qty", cell: (row) => formatQty(row.totalQty), className: "text-right tabular-nums", sortValue: (row) => row.totalQty };
  const customer: Column<ReturnListRow> = { id: "customer", header: "Customer", cell: (row) => row.customerName, sortValue: (row) => row.customerName };

  const columns: Column<ReturnListRow>[] = market
    ? [
        actions,
        date,
        number,
        mode,
        customer,
        qty,
        { id: "received", header: "Total Factory Rec. Qty", cell: (row) => formatQty(row.receivedQty), className: "text-right tabular-nums" },
        { id: "qc", header: "Total QC Qty", cell: (row) => formatQty(row.qcQty), className: "text-right tabular-nums" },
        { id: "status", header: "Status", cell: (row) => <Indicator color={STAGE_COLORS[row.marketStage]}>{MARKET_STAGE_LABELS[row.marketStage]}</Indicator> },
      ]
    : [
        actions,
        date,
        number,
        {
          id: "delivery",
          header: "Delivery No",
          cell: (row) =>
            row.deliveryId ? (
              <Link href={paths.delivery(row.deliveryId)} className="whitespace-nowrap text-ink hover:underline">
                {row.deliveryNumber}
              </Link>
            ) : (
              "—"
            ),
          hideBelow: "md",
        },
        { id: "code", header: "Customer Code", cell: (row) => row.customerCode, hideBelow: "lg" },
        customer,
        { id: "outlet", header: "Project/Outlet/Ref", cell: (row) => text(row.refProjectOutlet), hideBelow: "lg" },
        { id: "ref", header: "Return Ref. No", cell: (row) => text(row.refNo), hideBelow: "lg" },
        { id: "req", header: "Return Req. No", cell: (row) => text(row.requestNo), hideBelow: "lg" },
        qty,
        { id: "amount", header: "Return Amount", cell: (row) => formatAmount(row.totalAmount), className: "text-right tabular-nums", sortValue: (row) => row.totalAmount },
        mode,
        { id: "by", header: "Sales By", cell: (row) => text(row.salesPersonName), hideBelow: "md" },
        { id: "territory", header: "Territory", cell: (row) => text(row.territory), hideBelow: "lg" },
        { id: "kind", header: "Type", cell: (row) => RETURN_KIND_LABELS[row.kind], hideBelow: "lg" },
        {
          id: "status",
          header: "Status",
          cell: (row) =>
            row.kind === "MARKET" && row.status === "SUBMITTED" ? (
              <Indicator color={STAGE_COLORS[row.marketStage]}>{MARKET_STAGE_LABELS[row.marketStage]}</Indicator>
            ) : (
              <Indicator color={STATUS_COLORS[row.status]}>{RETURN_STATUS_LABELS[row.status]}</Indicator>
            ),
          sortValue: (row) => row.status,
        },
      ];

  const statusOptions = [all, ...RETURN_STATUSES.map((status) => ({ value: status, label: RETURN_STATUS_LABELS[status] }))];
  return (
    <>
      <FilterForm onSubmit={view} error={filterError} loading={list.loading}>
        <SelectField label="Office" options={filterLists.offices} {...field("officeId")} />
        {!market && <SelectField label="Customer Group" options={filterLists.groups} {...field("customerGroupId")} />}
        {!market && <SelectField label="Territory" options={filterLists.areaOptions("TERRITORY")} {...field("territoryId")} />}
        {!market && <SelectField label="Sales Force" options={filterLists.persons} {...field("salesPersonId")} />}
        {!market && <SelectField label="Return Type" options={[all, ...RETURN_MODES.map((value) => ({ value, label: RETURN_MODE_LABELS[value] }))]} {...field("mode")} />}
        <SelectField label="Status" options={statusOptions} {...field("status")} />
        <TextField label="From Date" type="date" {...field("from")} />
        <TextField label="To Date" type="date" {...field("to")} />
      </FilterForm>
      {list.error ? (
        <ErrorState message={errorMessage(list.error)} onRetry={list.reload} />
      ) : !data ? (
        <LoadingState />
      ) : (
        <div aria-busy={list.loading} className={list.loading ? "opacity-60 transition-opacity" : undefined}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-line px-4 py-2.5 text-sm">
            <span className="text-ink-muted">
              Returns <span className="font-medium text-ink tabular-nums">{data.totalCount}</span>
            </span>
            <span className="text-ink-muted">
              Qty <span className="font-medium text-ink tabular-nums">{formatQty(data.totalQty)}</span>
            </span>
            <span className="text-ink-muted">
              Return Amount <span className="font-semibold text-ink tabular-nums">{formatAmount(data.totalAmount)}</span>
            </span>
            {data.totalCount > data.rows.length && (
              <span className="text-xs text-warning">Showing the latest {data.rows.length}; narrow the filters to see the rest.</span>
            )}
          </div>
          <DataTable
            rows={data.rows}
            columns={columns}
            getRowId={(row) => row.id}
            getRowLabel={(row) => row.number}
            rowHref={(row) => paths.salesReturn(row.id)}
            search={{
              placeholder: "Search return no, delivery, customer",
              match: (row, needle) =>
                `${row.number} ${row.deliveryNumber ?? ""} ${row.customerName} ${row.customerCode} ${row.refNo ?? ""} ${row.requestNo ?? ""}`.toLowerCase().includes(needle),
            }}
            emptyState={<EmptyState title={market ? "No market returns in this range" : "No returns in this range"} />}
          />
        </div>
      )}
    </>
  );
}
