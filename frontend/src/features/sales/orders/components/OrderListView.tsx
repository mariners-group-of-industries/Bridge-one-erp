"use client";

import { Download, Ellipsis, Eye, Pencil, Plus, Printer, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { DropdownMenu, type MenuItem } from "@/components/ui/dropdown-menu";
import { SelectField, TextField } from "@/components/ui/form-field";
import { Card, EmptyState, ErrorState, LoadingState } from "@/components/ui/section";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { formatAmount } from "../../dashboard/lib/format";
import { downloadCsv } from "../../lib/csv";
import { addDays, formatDay, useToday } from "../../lib/use-today";
import { AREA_KIND_LABELS, CUSTOMER_TYPE_LABELS, type AreaKind } from "../../masters/schemas/masters.schema";
import { fetchSalesLookups, fetchSetupLookups } from "../../masters/services/masters.api";
import { paths } from "../../paths";
import {
  HOLD_REASONS,
  HOLD_REASON_LABELS,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_TYPES,
  ORDER_TYPE_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  orderListQuerySchema,
  type OrderListQuery,
  type OrderListRow,
} from "../schemas/order.schema";
import { fetchOrders } from "../services/order.api";
import { OrderStatusIndicator } from "./OrderStatusIndicator";

type Filters = Record<
  | "officeId"
  | "territoryId"
  | "customerGroupId"
  | "salesPersonId"
  | "status"
  | "holdReason"
  | "from"
  | "to"
  | "paymentMethod"
  | "orderType"
  | "zoneId"
  | "routeId"
  | "sectionId",
  string
>;

const all = { value: "", label: "All" };
const options = <T extends string>(values: readonly T[], labels: Record<T, string>) => [
  all,
  ...values.map((value) => ({ value, label: labels[value] })),
];

export function OrderListView() {
  const today = useToday();
  return (
    <PageContainer className="max-w-none">
      <PageHead
        title="Order Management"
        actions={
          <Link href={paths.newOrder} className={buttonClasses("primary")}>
            <Plus aria-hidden="true" />
            Create Sales Order
          </Link>
        }
      />
      {today ? <OrderList today={today} /> : <LoadingState />}
    </PageContainer>
  );
}

function OrderList({ today }: { today: string }) {
  const lookups = useResource("sales-lookups", fetchSalesLookups);
  const setup = useResource("setup:all", () => fetchSetupLookups());
  const initial: Filters = {
    officeId: "",
    territoryId: "",
    customerGroupId: "",
    salesPersonId: "",
    status: "",
    holdReason: "",
    from: addDays(today, -6),
    to: today,
    paymentMethod: "",
    orderType: "",
    zoneId: "",
    routeId: "",
    sectionId: "",
  };
  const [filters, setFilters] = useState<Filters>(initial);
  const [query, setQuery] = useState<OrderListQuery>({ from: initial.from, to: initial.to });
  const [filterError, setFilterError] = useState<string>();
  const list = useResource(JSON.stringify(query), () => fetchOrders(query));

  function view(event: FormEvent) {
    event.preventDefault();
    const raw = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    const parsed = orderListQuerySchema.safeParse(raw);
    if (!parsed.success) {
      setFilterError(parsed.error.issues[0]?.message);
      return;
    }
    setFilterError(undefined);
    if (JSON.stringify(parsed.data) === JSON.stringify(query)) list.reload();
    else setQuery(parsed.data);
  }

  const field = (key: keyof Filters) => ({
    value: filters[key],
    onChange: (event: { target: { value: string } }) => setFilters({ ...filters, [key]: event.target.value }),
  });
  const areaOptions = (kind: AreaKind) => [
    all,
    ...(setup.data?.areas ?? []).filter((area) => area.kind === kind).map((area) => ({ value: area.id, label: area.name })),
  ];

  function exportCsv() {
    if (!list.data) return;
    downloadCsv(
      `sales-orders-${query.from ?? "all"}-to-${query.to ?? "all"}.csv`,
      [
        "SO No",
        "Status",
        "Pending Reason",
        "SO Date",
        "Exp. Delivery Date",
        "Office",
        "Customer Code",
        "Customer Name",
        "Customer Type",
        "Project/Outlet/Ref",
        "Shipping Address",
        "Zone",
        "Territory",
        "Route",
        "Section",
        "Ref Customer PO",
        "Ref Customer PO Date",
        "Ref Customer PO Amount",
        "Ref Invoice",
        "Amount (BDT)",
        "Order By",
        "Type",
        "Payment Method",
      ],
      list.data.rows.map((row) => [
        row.number,
        ORDER_STATUS_LABELS[row.status],
        row.holdReason ? HOLD_REASON_LABELS[row.holdReason] : "",
        row.orderDate,
        row.expectedDeliveryDate,
        row.officeName,
        row.customerCode,
        row.customerName,
        CUSTOMER_TYPE_LABELS[row.customerType],
        row.refProjectOutlet,
        row.shippingAddress,
        row.zone,
        row.territory,
        row.route,
        row.section,
        row.refCustomerPo,
        row.refCustomerPoDate,
        row.refCustomerPoAmount,
        row.refInvoice,
        row.salesTotal.toFixed(2),
        row.salesPersonName,
        ORDER_TYPE_LABELS[row.orderType],
        PAYMENT_METHOD_LABELS[row.paymentMethod],
      ]),
    );
  }

  const rowActions = (row: OrderListRow): MenuItem[] => [
    { label: "View", icon: <Eye />, href: paths.order(row.id) },
    ...(row.status === "DRAFT" ? [{ label: "Edit", icon: <Pencil />, href: paths.editOrder(row.id) }] : []),
    { label: "Print", icon: <Printer />, href: paths.printOrder(row.id) },
  ];

  const text = (value: string | null) => value ?? "—";
  const columns: Column<OrderListRow>[] = [
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
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <span title={row.holdReason ? HOLD_REASON_LABELS[row.holdReason] : undefined}>
          <OrderStatusIndicator status={row.status} />
        </span>
      ),
      sortValue: (row) => row.status,
    },
    { id: "date", header: "SO Date", cell: (row) => formatDay(row.orderDate), sortValue: (row) => row.orderDate, className: "whitespace-nowrap" },
    {
      id: "delivery",
      header: "Exp. Delivery",
      cell: (row) => formatDay(row.expectedDeliveryDate),
      sortValue: (row) => row.expectedDeliveryDate,
      className: "whitespace-nowrap",
      hideBelow: "lg",
    },
    { id: "office", header: "Office Name", cell: (row) => row.officeName, hideBelow: "lg" },
    { id: "code", header: "Customer Code", cell: (row) => row.customerCode, hideBelow: "md" },
    { id: "customer", header: "Customer Name", cell: (row) => row.customerName, sortValue: (row) => row.customerName },
    { id: "type", header: "Customer Type", cell: (row) => CUSTOMER_TYPE_LABELS[row.customerType], hideBelow: "lg" },
    { id: "outlet", header: "Project/Outlet/Ref", cell: (row) => text(row.refProjectOutlet), hideBelow: "lg" },
    { id: "ship", header: "Shipping Address", cell: (row) => <span className="line-clamp-2 min-w-48">{text(row.shippingAddress)}</span>, hideBelow: "lg" },
    { id: "zone", header: "Zone", cell: (row) => text(row.zone), hideBelow: "lg" },
    { id: "route", header: "Route", cell: (row) => text(row.route), hideBelow: "lg" },
    { id: "section", header: "Section", cell: (row) => text(row.section), hideBelow: "lg" },
    { id: "po", header: "Ref Customer PO", cell: (row) => text(row.refCustomerPo), hideBelow: "lg" },
    { id: "poDate", header: "Ref PO Date", cell: (row) => (row.refCustomerPoDate ? formatDay(row.refCustomerPoDate) : "—"), hideBelow: "lg" },
    {
      id: "poAmount",
      header: "Ref PO Amount",
      cell: (row) => (row.refCustomerPoAmount === null ? "—" : formatAmount(row.refCustomerPoAmount)),
      className: "text-right tabular-nums",
      hideBelow: "lg",
    },
    { id: "invoice", header: "Ref Invoice", cell: (row) => text(row.refInvoice), hideBelow: "lg" },
    {
      id: "amount",
      header: "Amount (BDT)",
      cell: (row) => <span className="text-ink tabular-nums">{formatAmount(row.salesTotal)}</span>,
      sortValue: (row) => row.salesTotal,
      className: "text-right",
    },
    { id: "by", header: "Order By", cell: (row) => text(row.salesPersonName), hideBelow: "md" },
    { id: "territory", header: "Territory", cell: (row) => text(row.territory), hideBelow: "md" },
    { id: "orderType", header: "Type", cell: (row) => ORDER_TYPE_LABELS[row.orderType], hideBelow: "lg" },
    { id: "payment", header: "Payment", cell: (row) => PAYMENT_METHOD_LABELS[row.paymentMethod], hideBelow: "lg" },
    {
      id: "actions",
      header: "Action",
      cell: (row) => (
        <DropdownMenu
          trigger={<Ellipsis />}
          triggerLabel={`Actions for ${row.number}`}
          triggerClassName={buttonClasses("ghost", "icon")}
          items={rowActions(row)}
        />
      ),
      className: "w-12 text-right",
    },
  ];

  const offices = lookups.data?.offices ?? [];
  const persons = setup.data?.salesPersons ?? [];
  const groups = setup.data?.customerGroups ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <form onSubmit={view} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <SelectField label="Office" options={[all, ...offices.map((office) => ({ value: office.id, label: office.name }))]} {...field("officeId")} />
          <SelectField label="Territory" options={areaOptions("TERRITORY")} {...field("territoryId")} />
          <SelectField label="Customer Group" options={[all, ...groups.map((group) => ({ value: group.id, label: group.name }))]} {...field("customerGroupId")} />
          <SelectField label="Sales Force" options={[all, ...persons.map((person) => ({ value: person.id, label: person.name }))]} {...field("salesPersonId")} />
          <SelectField label="Status" options={options(ORDER_STATUSES, ORDER_STATUS_LABELS)} {...field("status")} />
          <SelectField label="Pending Reason" options={options(HOLD_REASONS, HOLD_REASON_LABELS)} {...field("holdReason")} />
          <TextField label="From Date" type="date" max={filters.to || undefined} {...field("from")} />
          <TextField label="To Date" type="date" min={filters.from || undefined} {...field("to")} />
          <SelectField label="Payment Method" options={options(PAYMENT_METHODS, PAYMENT_METHOD_LABELS)} {...field("paymentMethod")} />
          <SelectField label="Sales Type" options={options(ORDER_TYPES, ORDER_TYPE_LABELS)} {...field("orderType")} />
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
                setQuery({ from: initial.from, to: initial.to });
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
      </Card>

      <Card>
        {list.error ? (
          <ErrorState message={errorMessage(list.error)} onRetry={list.reload} />
        ) : !list.data ? (
          <LoadingState />
        ) : (
          <div aria-busy={list.loading} className={list.loading ? "opacity-60 transition-opacity" : undefined}>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-line px-4 py-2.5 text-sm">
              <span className="text-ink-muted">
                Orders <span className="font-medium text-ink tabular-nums">{list.data.totalCount}</span>
              </span>
              <span className="text-ink-muted">
                Total <span className="font-semibold text-ink tabular-nums">{formatAmount(list.data.totalAmount)}</span>
              </span>
              {list.data.totalCount > list.data.rows.length && (
                <span className="text-xs text-warning">
                  Showing the latest {list.data.rows.length}; narrow the filters to see the rest.
                </span>
              )}
              <Button size="sm" className="ml-auto" onClick={exportCsv} disabled={list.data.rows.length === 0}>
                <Download aria-hidden="true" />
                Excel (CSV)
              </Button>
            </div>
            <DataTable
              rows={list.data.rows}
              columns={columns}
              getRowId={(row) => row.id}
              getRowLabel={(row) => row.number}
              rowHref={(row) => paths.order(row.id)}
              search={{
                placeholder: "Search SO no, customer, PO",
                match: (row, needle) =>
                  `${row.number} ${row.customerName} ${row.customerCode} ${row.refCustomerPo ?? ""}`.toLowerCase().includes(needle),
              }}
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
      </Card>
    </div>
  );
}
