"use client";

import { Download, Eye, History, Pencil, Plus, Printer, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { CONTROL, SelectField, TextField } from "@/components/ui/form-field";
import { Card, ErrorState, LoadingState } from "@/components/ui/section";
import { EmptyState } from "@/features/sales/components/EmptyState";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatAmount } from "../../dashboard/lib/format";
import { addDays, formatDay, useToday } from "../../lib/use-today";
import { AREA_KIND_LABELS, type AreaKind } from "../../masters/schemas/masters.schema";
import { fetchSalesLookups, fetchSetupLookups } from "../../masters/services/masters.api";
import { paths } from "../../paths";
import {
  HOLD_REASON_LABELS,
  ORDER_PAGE_SIZES,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_TYPES,
  ORDER_TYPE_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  orderListQuerySchema,
  type OrderListQuery,
  type OrderListRow,
  type OrderStatus,
  type OrderType,
} from "../schemas/order.schema";
import { downloadOrdersExcel, fetchOrder, fetchOrders, orderPdfUrl } from "../services/order.api";
import { ApprovalTimeline } from "./OrderDetailView";

type Filters = Record<
  "officeId" | "territoryId" | "customerGroupId" | "salesPersonId" | "createdBy" | "status" | "pendingReasonId" | "from" | "to" | "paymentMethod" | "zoneId" | "routeId" | "sectionId",
  string
>;

const all = { value: "", label: "All" };
const options = <T extends string>(values: readonly T[], labels: Record<T, string>) => [all, ...values.map((value) => ({ value, label: labels[value] }))];
// Empty cells stay blank, as in Managerium.
const text = (value: string | null) => value ?? "";

/** Status as coloured text (Managerium): Pending orange, Approved green … */
const STATUS_TEXT: Record<OrderStatus, string> = {
  DRAFT: "text-ink-muted",
  PENDING_APPROVAL: "text-warning",
  APPROVED: "text-success",
  COMPLETED: "text-accent",
  CANCELLED: "text-danger",
};

/** Compact, vertically centred rows like Managerium. */
const ROW_CELL = "py-1.5! align-middle!";

/** `value` once it has stopped changing for 400 ms. */
function useDebounced(value: string) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), 400);
    return () => clearTimeout(timer);
  }, [value]);
  return settled;
}

/** Order Management: sales orders by type (tabs), with Managerium's filters and columns. */
export function OrderListView() {
  const today = useToday();
  if (!today) {
    return (
      <PageContainer className="max-w-none">
        <PageHead title="Order Management" />
        <LoadingState />
      </PageContainer>
    );
  }
  return <OrderList today={today} />;
}

function OrderList({ today }: { today: string }) {
  const lookups = useResource("sales-lookups", fetchSalesLookups);
  const setup = useResource("setup:all", () => fetchSetupLookups());
  const initial: Filters = {
    officeId: "",
    territoryId: "",
    customerGroupId: "",
    salesPersonId: "",
    createdBy: "",
    status: "",
    pendingReasonId: "",
    from: addDays(today, -6),
    to: today,
    paymentMethod: "",
    zoneId: "",
    routeId: "",
    sectionId: "",
  };
  const [orderType, setOrderType] = useState<OrderType>("SALES");
  const [filters, setFilters] = useState<Filters>(initial);
  const toQuery = (values: Filters, type: OrderType) => ({ ...Object.fromEntries(Object.entries(values).filter(([, value]) => value)), orderType: type });
  const [query, setQuery] = useState<OrderListQuery>(() => orderListQuerySchema.parse(toQuery(initial, "SALES")));
  const [filterError, setFilterError] = useState<string>();
  const [search, setSearch] = useState("");
  const searched = useDebounced(search.trim());
  // The header search runs on the server across every matching order, with the filters.
  const effective: OrderListQuery = { ...query, ...(searched ? { search: searched } : {}) };
  const list = useResource(JSON.stringify(effective), () => fetchOrders(effective), { refreshOnFocus: true });
  const [history, setHistory] = useState<OrderListRow | null>(null);
  const [exporting, setExporting] = useState(false);
  const toast = useToast();

  function apply(values: Filters, type: OrderType) {
    const parsed = orderListQuerySchema.safeParse(toQuery(values, type));
    if (!parsed.success) {
      setFilterError(parsed.error.issues[0]?.message);
      return;
    }
    setFilterError(undefined);
    if (JSON.stringify(parsed.data) === JSON.stringify(query)) list.reload();
    else setQuery(parsed.data);
  }

  function view(event: FormEvent) {
    event.preventDefault();
    apply(filters, orderType);
  }

  const field = (key: keyof Filters) => ({
    value: filters[key],
    onChange: (event: { target: { value: string } }) => setFilters({ ...filters, [key]: event.target.value }),
  });
  const areaOptions = (kind: AreaKind) => [
    all,
    // Sales Setup regions etc. filter every territory below them.
    ...(kind === "TERRITORY" ? (setup.data?.territoryGroups ?? []).map((node) => ({ value: node.id, label: `${node.layer}: ${node.name} (all)` })) : []),
    ...(setup.data?.areas ?? []).filter((area) => area.kind === kind).map((area) => ({ value: area.id, label: area.name })),
  ];

  async function exportExcel() {
    setExporting(true);
    try {
      await downloadOrdersExcel(effective);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setExporting(false);
    }
  }

  const columns: Column<OrderListRow>[] = [
    { id: "sl", header: "SL", cell: (_row, index) => <span className="text-ink-faint tabular-nums">{index + 1}</span>, className: "w-10" },
    {
      id: "actions",
      header: "Action",
      cell: (row) => (
        <span className="flex items-center gap-0.5">
          <Link href={paths.order(row.id)} aria-label={`View ${row.number}`} title="View" className={buttonClasses("ghost", "icon")}>
            <Eye />
          </Link>
          {row.status === "DRAFT" ? (
            <Link href={paths.editOrder(row.id)} aria-label={`Edit ${row.number}`} title="Edit" className={buttonClasses("ghost", "icon")}>
              <Pencil />
            </Link>
          ) : (
            <span aria-hidden="true" title="Only draft orders can be edited" className={buttonClasses("ghost", "icon") + " opacity-30"}>
              <Pencil />
            </span>
          )}
          <Button variant="ghost" size="icon" aria-label={`History of ${row.number}`} title="History" onClick={() => setHistory(row)}>
            <History />
          </Button>
          <a href={orderPdfUrl(row.id)} target="_blank" rel="noopener" aria-label={`Print ${row.number}`} title="Print (PDF)" className={buttonClasses("ghost", "icon")}>
            <Printer />
          </a>
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <span title={row.pendingReasonName ?? (row.holdReason ? HOLD_REASON_LABELS[row.holdReason] : undefined)}>
          <span className={cn("font-medium", STATUS_TEXT[row.status])}>{ORDER_STATUS_LABELS[row.status]}</span>
        </span>
      ),
      // Not sortable, so the list opens newest SO date first (the first sortable column).
      className: "text-center",
    },
    { id: "date", header: "SO Date", cell: (row) => formatDay(row.orderDate), sortValue: (row) => row.orderDate, className: "whitespace-nowrap" },
    { id: "delivery", header: "Exp. Delivery Date", cell: (row) => formatDay(row.expectedDeliveryDate), sortValue: (row) => row.expectedDeliveryDate, className: "whitespace-nowrap", hideBelow: "lg" },
    {
      id: "number",
      header: "SO No",
      cell: (row) => (
        <Link href={paths.order(row.id)} className="font-medium whitespace-nowrap text-ink hover:underline">
          {row.number}
        </Link>
      ),
      sortValue: (row) => row.number,
    },
    { id: "office", header: "Office Name", cell: (row) => row.officeName, hideBelow: "lg" },
    { id: "code", header: "Customer Code", cell: (row) => row.customerCode, hideBelow: "md" },
    { id: "customer", header: "Customer Name", cell: (row) => <span className="min-w-36">{row.customerName}</span>, sortValue: (row) => row.customerName },
    { id: "outlet", header: "Project/Outlet/Ref", cell: (row) => text(row.refProjectOutlet), hideBelow: "lg" },
    { id: "ship", header: "Shipping Address", cell: (row) => <span className="line-clamp-2 min-w-48">{text(row.shippingAddress)}</span>, hideBelow: "lg" },
    { id: "zone", header: "Zone", cell: (row) => text(row.zone), hideBelow: "lg" },
    { id: "route", header: "Route", cell: (row) => text(row.route), hideBelow: "lg" },
    { id: "section", header: "Section", cell: (row) => text(row.section), hideBelow: "lg" },
    { id: "po", header: "Ref Customer PO", cell: (row) => text(row.refCustomerPo), hideBelow: "lg" },
    { id: "poDate", header: "Ref Customer PO Date", cell: (row) => (row.refCustomerPoDate ? formatDay(row.refCustomerPoDate) : ""), className: "whitespace-nowrap", hideBelow: "lg" },
    { id: "poAmount", header: "Ref Customer PO Amount", cell: (row) => formatAmount(row.refCustomerPoAmount ?? 0), className: "text-right tabular-nums", hideBelow: "lg" },
    { id: "invoice", header: "Ref Invoice", cell: (row) => text(row.refInvoice), hideBelow: "lg" },
    { id: "amount", header: "Amount (BDT)", cell: (row) => <span className="text-ink">{formatAmount(row.salesTotal)}</span>, sortValue: (row) => row.salesTotal, className: "text-right tabular-nums" },
    { id: "by", header: "Order By", cell: (row) => text(row.salesPersonName), hideBelow: "md" },
    { id: "territory", header: "Territory Name", cell: (row) => text(row.territory), hideBelow: "md" },
    { id: "orderType", header: "Type", cell: (row) => <span className="text-success">{ORDER_TYPE_LABELS[row.orderType]}</span>, hideBelow: "lg" },
    { id: "payment", header: "Payment Method", cell: (row) => PAYMENT_METHOD_LABELS[row.paymentMethod], hideBelow: "lg" },
  ];

  const offices = lookups.data?.offices ?? [];
  const persons = setup.data?.salesPersons ?? [];
  const groups = setup.data?.customerGroups ?? [];
  const reasons = setup.data?.deliveryReasons ?? [];

  return (
    <PageContainer className="max-w-none">
      <PageHead
        title="Order Management"
        actions={
          <>
            <label className="relative w-56">
              <span className="sr-only">Search orders</span>
              <Search aria-hidden="true" className="pointer-events-none absolute top-1.5 left-2 size-4 text-ink-faint" />
              <input type="search" value={search} placeholder="Search…" onChange={(event) => setSearch(event.target.value)} className={cn(CONTROL, "h-7 pl-7")} />
            </label>
            <Button onClick={exportExcel} loading={exporting} disabled={!list.data || list.data.rows.length === 0}>
              <Download aria-hidden="true" />
              Excel
            </Button>
            <Link href={paths.newOrder} className={buttonClasses("primary")}>
              <Plus aria-hidden="true" />
              Create Sales Order
            </Link>
          </>
        }
      />
      <Card>
        <Tabs<OrderType>
          label="Order types"
          tabs={ORDER_TYPES.map((type) => ({ id: type, label: ORDER_TYPE_LABELS[type] }))}
          value={orderType}
          onChange={(next) => {
            setOrderType(next);
            apply(filters, next);
          }}
        >
          <form onSubmit={view} className="grid items-end gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <SelectField label="Office" options={[all, ...offices.map((office) => ({ value: office.id, label: office.name }))]} {...field("officeId")} />
            <SelectField label="Territory" options={areaOptions("TERRITORY")} {...field("territoryId")} />
            <SelectField label="Customer Group" options={[all, ...groups.map((group) => ({ value: group.id, label: group.name }))]} {...field("customerGroupId")} />
            <SelectField label="Sales Force" options={[all, ...persons.map((person) => ({ value: person.id, label: person.name }))]} {...field("salesPersonId")} />
            <SelectField label="Order By" hint="Who entered the order." options={[all, ...(list.data?.creators ?? []).map((user) => ({ value: user.id, label: user.name }))]} {...field("createdBy")} />
            <SelectField label="Status" options={options(ORDER_STATUSES, ORDER_STATUS_LABELS)} {...field("status")} />
            <SelectField label="Pending Reason" options={[all, ...reasons.map((reason) => ({ value: reason.id, label: reason.name }))]} {...field("pendingReasonId")} />
            <TextField label="From Date" type="date" max={filters.to || undefined} {...field("from")} />
            <TextField label="To Date" type="date" min={filters.from || undefined} {...field("to")} />
            <SelectField label="Payment Method" options={options(PAYMENT_METHODS, PAYMENT_METHOD_LABELS)} {...field("paymentMethod")} />
            <SelectField label={AREA_KIND_LABELS.ZONE} options={areaOptions("ZONE")} {...field("zoneId")} />
            <SelectField label={AREA_KIND_LABELS.ROUTE} options={areaOptions("ROUTE")} {...field("routeId")} />
            <SelectField label={AREA_KIND_LABELS.SECTION} options={areaOptions("SECTION")} {...field("sectionId")} />
            <div className="flex gap-2">
              <Button type="submit" variant="primary" disabled={list.loading}>
                <RefreshCw aria-hidden="true" />
                View
              </Button>
              <Button
                onClick={() => {
                  setFilters(initial);
                  apply(initial, orderType);
                }}
              >
                Reset
              </Button>
            </div>
            {filterError && (
              <p role="alert" className="text-xs text-danger sm:col-span-2 lg:col-span-4 xl:col-span-6">
                {filterError}
              </p>
            )}
          </form>

          {list.error ? (
            <ErrorState message={errorMessage(list.error)} onRetry={list.reload} />
          ) : !list.data ? (
            <LoadingState />
          ) : (
            <div aria-busy={list.loading} className={list.loading ? "opacity-60 transition-opacity" : undefined}>
              {list.data.totalCount > list.data.rows.length && (
                <p className="border-b border-line px-4 py-2 text-xs text-warning">
                  Showing the latest {list.data.rows.length} of {list.data.totalCount}; narrow the filters to see the rest. Total of all: {formatAmount(list.data.totalAmount)}.
                </p>
              )}
              <DataTable
                rows={list.data.rows}
                columns={columns.map((column) => ({ ...column, className: cn(ROW_CELL, column.className) }))}
                getRowId={(row) => row.id}
                getRowLabel={(row) => row.number}
                rowHref={(row) => paths.order(row.id)}
                pages={ORDER_PAGE_SIZES}
                footer={(rows) => ({
                  customer: "Total:",
                  amount: formatAmount(rows.reduce((sum, row) => sum + row.salesTotal, 0)),
                })}
                emptyState={
                  <EmptyState title="No sales orders found">
                    <Link href={paths.newOrder} className="font-medium text-ink underline underline-offset-2">
                      Create a sales order
                    </Link>{" "}
                    or change the filters.
                  </EmptyState>
                }
              />
            </div>
          )}
        </Tabs>
      </Card>
      <HistoryDialog row={history} onClose={() => setHistory(null)} />
    </PageContainer>
  );
}

/** Audit trail of one order (who created, submitted, approved … and when). */
function HistoryDialog({ row, onClose }: { row: OrderListRow | null; onClose: () => void }) {
  const order = useResource(row ? `order:${row.id}:${row.updatedAt}` : null, () => fetchOrder(row!.id));
  return (
    <Dialog open={row !== null} onClose={onClose} title={row ? `History · ${row.number}` : "History"} size="lg">
      {order.error ? (
        <ErrorState message={errorMessage(order.error)} onRetry={order.reload} />
      ) : !order.data ? (
        <LoadingState />
      ) : (
        <ApprovalTimeline order={order.data} />
      )}
    </Dialog>
  );
}
