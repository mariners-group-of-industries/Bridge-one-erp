"use client";

import { Ban, Download, Ellipsis, Eye, Pencil, Plus, Printer, RefreshCw, Repeat, Truck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu, type MenuItem } from "@/components/ui/dropdown-menu";
import { CONTROL, CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/form-field";
import { Indicator } from "@/components/ui/indicator";
import { Card, EmptyState, ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatAmount } from "../../dashboard/lib/format";
import { downloadCsv } from "../../lib/csv";
import { addDays, formatDay, useToday } from "../../lib/use-today";
import type { AreaKind, SetupLookups } from "../../masters/schemas/masters.schema";
import { fetchSalesLookups, fetchSetupLookups } from "../../masters/services/masters.api";
import { ORDER_TYPE_LABELS, PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "../../orders/schemas/order.schema";
import { changeOrderStatus } from "../../orders/services/order.api";
import { paths } from "../../paths";
import { SimpleMastersPanel } from "../../setup/components/SimpleMastersPanel";
import {
  APPROVED_ORDER_STATUSES,
  APPROVED_ORDER_STATUS_LABELS,
  CONFIRMATIONS,
  CONFIRMATION_LABELS,
  DELIVERY_TYPES,
  DELIVERY_TYPE_LABELS,
  approvedOrderQuerySchema,
  deliveryListQuerySchema,
  type ApprovedOrderQuery,
  type ApprovedOrderRow,
  type DeliveryListQuery,
  type DeliveryListRow,
} from "../schemas/delivery.schema";
import { fetchApprovedOrders, fetchDeliveries, setPendingReason } from "../services/delivery.api";

type Tab = "approved" | "deliveries" | "exchanges" | "challans";
const TABS: { id: Tab; label: string }[] = [
  { id: "approved", label: "Approved SO" },
  { id: "deliveries", label: "Delivery List" },
  { id: "exchanges", label: "Exchange List" },
  { id: "challans", label: "Challan List" },
];
const isTab = (value: string | null): value is Tab => TABS.some((tab) => tab.id === value);

const all = { value: "", label: "All" };
const options = <T extends string>(values: readonly T[], labels: Record<T, string>) => [all, ...values.map((value) => ({ value, label: labels[value] }))];
const text = (value: string | null) => value ?? "—";

/** /sales/deliveries?tab=… — read the tab inside <Suspense> (search params are request-time). */
export function DeliveryWorkspaceView() {
  const today = useToday();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab: Tab = isTab(params.get("tab")) ? (params.get("tab") as Tab) : "approved";
  const [exportRows, setExportRows] = useState<(() => void) | null>(null);

  const action =
    tab === "exchanges" ? (
      <Link href={paths.newExchange} className={buttonClasses("primary")}>
        <Repeat aria-hidden="true" />
        Exchange
      </Link>
    ) : (
      <Link href={paths.newDirectDelivery} className={buttonClasses("primary")}>
        <Plus aria-hidden="true" />
        Direct Delivery
      </Link>
    );

  return (
    <PageContainer className="max-w-none">
      <PageHead
        title="Sales Delivery"
        actions={
          <>
            <Button onClick={() => exportRows?.()} disabled={!exportRows}>
              <Download aria-hidden="true" />
              Excel (CSV)
            </Button>
            {action}
          </>
        }
      />
      <Card>
        <Tabs<Tab> label="Delivery lists" tabs={TABS} value={tab} onChange={(next) => router.replace(`${pathname}?tab=${next}`)}>
          {!today ? (
            <LoadingState />
          ) : tab === "approved" ? (
            <ApprovedOrdersTab key="approved" today={today} onExport={setExportRows} />
          ) : (
            <DeliveriesTab key={tab} tab={tab} today={today} onExport={setExportRows} />
          )}
        </Tabs>
      </Card>
    </PageContainer>
  );
}

/** Shared master lists for the filters (all business units in scope). */
export function useFilterLookups() {
  const lookups = useResource("sales-lookups", fetchSalesLookups);
  const setup = useResource("setup:all", () => fetchSetupLookups());
  const areaOptions = (kind: AreaKind) => [
    all,
    ...(setup.data?.areas ?? []).filter((area) => area.kind === kind).map((area) => ({ value: area.id, label: area.name })),
  ];
  return {
    lookups,
    setup,
    offices: [all, ...(lookups.data?.offices ?? []).map((office) => ({ value: office.id, label: office.name }))],
    groups: [all, ...(setup.data?.customerGroups ?? []).map((group) => ({ value: group.id, label: group.name }))],
    persons: [all, ...(setup.data?.salesPersons ?? []).map((person) => ({ value: person.id, label: person.name }))],
    areaOptions,
  };
}

export function FilterForm({ onSubmit, error, loading, children, extra }: { onSubmit: (event: FormEvent) => void; error?: string; loading: boolean; children: ReactNode; extra?: ReactNode }) {
  return (
    <form onSubmit={onSubmit} className="grid items-end gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
      {children}
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={loading}>
          <RefreshCw aria-hidden="true" />
          View
        </Button>
        {extra}
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger sm:col-span-2 lg:col-span-4 xl:col-span-6">
          {error}
        </p>
      )}
    </form>
  );
}

// ─── Approved SO ─────────────────────────────────────────────────────────────

type ApprovedFilters = Record<"officeId" | "customerGroupId" | "territoryId" | "status" | "zoneId" | "routeId" | "sectionId" | "from" | "to" | "salesPersonId", string>;

function ApprovedOrdersTab({ today, onExport }: { today: string; onExport: (fn: (() => void) | null) => void }) {
  const toast = useToast();
  const filterLists = useFilterLookups();
  const initial: ApprovedFilters = {
    officeId: "",
    customerGroupId: "",
    territoryId: "",
    status: "",
    zoneId: "",
    routeId: "",
    sectionId: "",
    from: addDays(today, -30),
    to: today,
    salesPersonId: "",
  };
  const [filters, setFilters] = useState(initial);
  const [query, setQuery] = useState<ApprovedOrderQuery>({ from: initial.from, to: initial.to });
  const [filterError, setFilterError] = useState<string>();
  const list = useResource(`approved:${JSON.stringify(query)}`, () => fetchApprovedOrders(query));
  const [closing, setClosing] = useState<ApprovedOrderRow | null>(null);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [reasonsOpen, setReasonsOpen] = useState(false);
  const firstUnit = filterLists.lookups.data?.offices[0]?.businessUnitId;
  const reasonSetup = useResource(reasonsOpen && firstUnit ? `setup:${firstUnit}:reasons` : null, () => fetchSetupLookups(firstUnit));

  const field = (key: keyof ApprovedFilters) => ({
    value: filters[key],
    onChange: (event: { target: { value: string } }) => setFilters({ ...filters, [key]: event.target.value }),
  });

  function view(event: FormEvent) {
    event.preventDefault();
    const parsed = approvedOrderQuerySchema.safeParse(Object.fromEntries(Object.entries(filters).filter(([, value]) => value)));
    if (!parsed.success) return setFilterError(parsed.error.issues[0]?.message);
    setFilterError(undefined);
    if (JSON.stringify(parsed.data) === JSON.stringify(query)) list.reload();
    else setQuery(parsed.data);
  }

  async function changeReason(row: ApprovedOrderRow, reasonId: string) {
    try {
      await setPendingReason(row.id, reasonId || null);
      list.mutate((rows) => (rows ?? []).map((candidate) => (candidate.id === row.id ? { ...candidate, pendingReasonId: reasonId || null } : candidate)));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function closeOrder() {
    if (!closing) return;
    setBusy(true);
    try {
      await changeOrderStatus(closing.id, "complete", closing.updatedAt, today, remarks);
      toast.success(`${closing.number} closed.`);
      setClosing(null);
      list.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const reasons = filterLists.setup.data?.deliveryReasons ?? [];
  const rows = list.data;
  const exporter = rows
    ? () =>
        downloadCsv(
          `approved-orders-${today}.csv`,
          ["SO No", "Status", "SO Date", "Exp. Delivery Date", "Office", "Customer Code", "Customer", "Shipping Address", "Zone", "Route", "Section", "Customer PO", "Order By", "Territory", "Type", "Delivered %", "Amount", "Pending Reason"],
          rows.map((row) => [
            row.number,
            APPROVED_ORDER_STATUS_LABELS[row.status],
            row.orderDate,
            row.expectedDeliveryDate,
            row.officeName,
            row.customerCode,
            row.customerName,
            row.shippingAddress,
            row.zone,
            row.route,
            row.section,
            row.refCustomerPo,
            row.salesPersonName,
            row.territory,
            ORDER_TYPE_LABELS[row.orderType],
            row.deliveredPercent,
            row.salesTotal.toFixed(2),
            reasons.find((reason) => reason.id === row.pendingReasonId)?.name ?? "",
          ]),
        )
    : null;
  // Register the export of the current rows with the page head.
  useExport(exporter, onExport);

  const columns: Column<ApprovedOrderRow>[] = [
    {
      id: "actions",
      header: "Action",
      cell: (row) => (
        <span className="flex items-center gap-0.5">
          <Link href={paths.printOrder(row.id)} aria-label={`Print ${row.number}`} title="Print order" className={buttonClasses("ghost", "icon")}>
            <Printer />
          </Link>
          <Link href={paths.deliverOrder(row.id)} aria-label={`Deliver ${row.number}`} title="Deliver" className={buttonClasses("ghost", "icon")}>
            <Truck />
          </Link>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Close ${row.number}`}
            title="Close order (no more delivery)"
            onClick={() => {
              setRemarks("");
              setClosing(row);
            }}
          >
            <Ban />
          </Button>
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <Indicator color={row.status === "APPROVED" ? "green" : "purple"}>
          {APPROVED_ORDER_STATUS_LABELS[row.status]}
          {row.status === "PARTIALLY_DELIVERED" && ` ${row.deliveredPercent}%`}
        </Indicator>
      ),
      sortValue: (row) => row.status,
    },
    { id: "date", header: "SO Date", cell: (row) => formatDay(row.orderDate), sortValue: (row) => row.orderDate, className: "whitespace-nowrap" },
    { id: "exp", header: "Exp. Delivery", cell: (row) => formatDay(row.expectedDeliveryDate), sortValue: (row) => row.expectedDeliveryDate, className: "whitespace-nowrap" },
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
    { id: "office", header: "Office", cell: (row) => row.officeName, hideBelow: "lg" },
    { id: "code", header: "Customer Code", cell: (row) => row.customerCode, hideBelow: "md" },
    { id: "customer", header: "Customer Name", cell: (row) => row.customerName, sortValue: (row) => row.customerName },
    { id: "ship", header: "Shipping Address", cell: (row) => <span className="line-clamp-2 min-w-40">{text(row.shippingAddress)}</span>, hideBelow: "lg" },
    { id: "zone", header: "Zone", cell: (row) => text(row.zone), hideBelow: "lg" },
    { id: "route", header: "Route", cell: (row) => text(row.route), hideBelow: "lg" },
    { id: "section", header: "Section", cell: (row) => text(row.section), hideBelow: "lg" },
    { id: "po", header: "Customer PO/Ref", cell: (row) => text(row.refCustomerPo), hideBelow: "lg" },
    { id: "by", header: "Order By", cell: (row) => text(row.salesPersonName), hideBelow: "md" },
    { id: "territory", header: "Territory", cell: (row) => text(row.territory), hideBelow: "md" },
    { id: "type", header: "Type", cell: (row) => ORDER_TYPE_LABELS[row.orderType], hideBelow: "lg" },
    {
      id: "reason",
      header: "Pending Reason",
      cell: (row) => (
        <select
          aria-label={`Pending reason for ${row.number}`}
          value={row.pendingReasonId ?? ""}
          onChange={(event) => changeReason(row, event.target.value)}
          className={cn(CONTROL, "h-7 min-w-36")}
        >
          <option value="">Select a reason</option>
          {reasons
            .filter((reason) => reason.businessUnitId === row.businessUnitId)
            .map((reason) => (
              <option key={reason.id} value={reason.id}>
                {reason.name}
              </option>
            ))}
        </select>
      ),
    },
  ];

  return (
    <>
      <FilterForm
        onSubmit={view}
        error={filterError}
        loading={list.loading}
        extra={
          <Button size="sm" className="ml-auto" onClick={() => setReasonsOpen(true)} disabled={!firstUnit}>
            Create Reason
          </Button>
        }
      >
        <SelectField label="Office" options={filterLists.offices} {...field("officeId")} />
        <SelectField label="Customer Group" options={filterLists.groups} {...field("customerGroupId")} />
        <SelectField label="Territory" options={filterLists.areaOptions("TERRITORY")} {...field("territoryId")} />
        <SelectField label="Status" options={options(APPROVED_ORDER_STATUSES, APPROVED_ORDER_STATUS_LABELS)} {...field("status")} />
        <SelectField label="Zone" options={filterLists.areaOptions("ZONE")} {...field("zoneId")} />
        <SelectField label="Route" options={filterLists.areaOptions("ROUTE")} {...field("routeId")} />
        <SelectField label="Section" options={filterLists.areaOptions("SECTION")} {...field("sectionId")} />
        <TextField label="From Date (SO)" type="date" {...field("from")} />
        <TextField label="To Date (SO)" type="date" {...field("to")} />
        <SelectField label="Order By" options={filterLists.persons} {...field("salesPersonId")} />
      </FilterForm>
      {list.error ? (
        <ErrorState message={errorMessage(list.error)} onRetry={list.reload} />
      ) : !rows ? (
        <LoadingState />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.number}
          search={{ placeholder: "Search SO no or customer", match: (row, needle) => `${row.number} ${row.customerName} ${row.customerCode}`.toLowerCase().includes(needle) }}
          emptyState={<EmptyState title="No approved orders waiting for delivery" />}
        />
      )}

      <Dialog
        open={closing !== null}
        title={`Close ${closing?.number ?? ""}`}
        description="The rest of this order will not be delivered. Delivered quantities stay."
        onClose={busy ? () => undefined : () => setClosing(null)}
        onSubmit={closeOrder}
        footer={
          <>
            <Button onClick={() => setClosing(null)} disabled={busy}>
              Back
            </Button>
            <Button type="submit" variant="danger" loading={busy} disabled={!remarks.trim()}>
              Close Order
            </Button>
          </>
        }
      >
        <TextAreaField label="Reason" required rows={3} value={remarks} onChange={(event) => setRemarks(event.target.value)} />
      </Dialog>

      <Dialog open={reasonsOpen} size="lg" title="Delivery Pending Reasons" onClose={() => { setReasonsOpen(false); filterLists.setup.reload(); }}>
        {reasonSetup.data && firstUnit ? (
          <SimpleMastersPanel kind="delivery-reasons" businessUnitId={firstUnit} lookups={reasonSetup.data as SetupLookups} onChanged={reasonSetup.reload} />
        ) : (
          <LoadingState />
        )}
      </Dialog>
    </>
  );
}

/** Hands the current export function to the page head (and clears it on unmount). */
export function useExport(exporter: (() => void) | null, onExport: (fn: (() => void) | null) => void) {
  const latest = useRef(exporter);
  const ready = exporter !== null;
  useEffect(() => {
    latest.current = exporter;
  });
  useEffect(() => {
    onExport(ready ? () => () => latest.current?.() : null);
    return () => onExport(null);
  }, [ready, onExport]);
}

// ─── Delivery / Exchange / Challan lists ─────────────────────────────────────

type ListFilters = Record<
  "officeId" | "deliveryType" | "confirmation" | "customerGroupId" | "territoryId" | "zoneId" | "routeId" | "sectionId" | "from" | "to" | "paymentMethod" | "vehicleNo",
  string
> & { deleted: boolean };

function DeliveriesTab({ tab, today, onExport }: { tab: Exclude<Tab, "approved">; today: string; onExport: (fn: (() => void) | null) => void }) {
  const filterLists = useFilterLookups();
  const fixedType = tab === "exchanges" ? "EXCHANGE" : "";
  const initial: ListFilters = {
    officeId: "",
    deliveryType: fixedType,
    confirmation: "",
    customerGroupId: "",
    territoryId: "",
    zoneId: "",
    routeId: "",
    sectionId: "",
    from: addDays(today, -7),
    to: today,
    paymentMethod: "",
    vehicleNo: "",
    deleted: false,
  };
  const [filters, setFilters] = useState(initial);
  const toQuery = (values: ListFilters): DeliveryListQuery =>
    Object.fromEntries(Object.entries({ ...values, deleted: values.deleted ? "true" : "" }).filter(([, value]) => value)) as DeliveryListQuery;
  const [query, setQuery] = useState<DeliveryListQuery>(toQuery(initial));
  const [filterError, setFilterError] = useState<string>();
  const list = useResource(`deliveries:${JSON.stringify(query)}`, () => fetchDeliveries(query));

  const field = (key: Exclude<keyof ListFilters, "deleted">) => ({
    value: filters[key],
    onChange: (event: { target: { value: string } }) => setFilters({ ...filters, [key]: event.target.value }),
  });

  function view(event: FormEvent) {
    event.preventDefault();
    const next = toQuery(filters);
    const parsed = deliveryListQuerySchema.safeParse(next);
    if (!parsed.success) return setFilterError(parsed.error.issues[0]?.message);
    setFilterError(undefined);
    if (JSON.stringify(next) === JSON.stringify(query)) list.reload();
    else setQuery(next);
  }

  const data = list.data;
  const exporter = data
    ? () =>
        downloadCsv(
          `${tab}-${today}.csv`,
          ["Invoice", "Challan No", "VAT Challan No", "Type", "Confirmation", "Delivery Date", "Order Date", "SO No", "Office", "Sales Force", "Vehicle No", "Customer Group", "Customer Code", "Customer", "Project/Outlet/Ref", "Shipping Address", "Zone", "Route", "Section", "Ref Customer PO", "Ref PO Date", "Ref Invoice", "Payment Method", "Total Amount", "Paid", "Returned", "Pending Amount", "Deleted"],
          data.rows.map((row) => [
            row.number,
            row.challanNo,
            row.vatChallanNo,
            DELIVERY_TYPE_LABELS[row.deliveryType],
            CONFIRMATION_LABELS[row.confirmation],
            row.deliveryDate,
            row.orderDate,
            row.orderNumber,
            row.officeName,
            row.salesPersonName,
            row.vehicleNo,
            row.customerGroup,
            row.customerCode,
            row.customerName,
            row.refProjectOutlet,
            row.shippingAddress,
            row.zone,
            row.route,
            row.section,
            row.refCustomerPo,
            row.refCustomerPoDate,
            row.refInvoice,
            PAYMENT_METHOD_LABELS[row.paymentMethod],
            row.totalAmount.toFixed(2),
            row.paidAmount.toFixed(2),
            row.returnAmount.toFixed(2),
            row.pendingAmount.toFixed(2),
            row.deleted ? "Yes" : "No",
          ]),
        )
    : null;
  useExport(exporter, onExport);

  const printItems = (row: DeliveryListRow): MenuItem[] => [
    { label: "Challan (with header)", icon: <Printer />, href: paths.printDelivery(row.id, "challan") },
    { label: "Challan (without header)", icon: <Printer />, href: paths.printDelivery(row.id, "challan-plain") },
    { label: "Mushak 6.3", icon: <Printer />, href: paths.printDelivery(row.id, "mushak") },
    { label: "Sales Invoice", icon: <Printer />, href: paths.printDelivery(row.id, "invoice") },
  ];

  const columns: Column<DeliveryListRow>[] = [
    {
      id: "actions",
      header: "Action",
      cell: (row) => (
        <span className="flex items-center gap-0.5">
          <Link href={paths.delivery(row.id)} aria-label={`View ${row.number}`} title="View" className={buttonClasses("ghost", "icon")}>
            <Eye />
          </Link>
          {!row.deleted && row.confirmation === "PENDING" && (
            <Link href={paths.editDelivery(row.id)} aria-label={`Edit ${row.number}`} title="Edit" className={buttonClasses("ghost", "icon")}>
              <Pencil />
            </Link>
          )}
          <DropdownMenu trigger={<Ellipsis />} triggerLabel={`Print ${row.number}`} triggerClassName={buttonClasses("ghost", "icon")} items={printItems(row)} />
        </span>
      ),
    },
    { id: "type", header: "Type", cell: (row) => <span className="text-success">{DELIVERY_TYPE_LABELS[row.deliveryType]}</span> },
    {
      id: "confirmation",
      header: "Confirmation",
      cell: (row) =>
        row.deleted ? (
          <Indicator color="red">Deleted</Indicator>
        ) : (
          <Indicator color={row.confirmation === "CONFIRMED" ? "green" : "orange"}>{CONFIRMATION_LABELS[row.confirmation]}</Indicator>
        ),
      sortValue: (row) => row.confirmation,
    },
    { id: "date", header: "Delivery Date", cell: (row) => formatDay(row.deliveryDate), sortValue: (row) => row.deliveryDate, className: "whitespace-nowrap" },
    { id: "orderDate", header: "Order Date", cell: (row) => (row.orderDate ? formatDay(row.orderDate) : "—"), className: "whitespace-nowrap", hideBelow: "lg" },
    {
      id: "so",
      header: "SO No",
      cell: (row) =>
        row.salesOrderId ? (
          <Link href={paths.order(row.salesOrderId)} className="whitespace-nowrap text-ink hover:underline">
            {row.orderNumber}
          </Link>
        ) : (
          "—"
        ),
      hideBelow: "md",
    },
    { id: "sf", header: "Sales Force", cell: (row) => text(row.salesPersonName), hideBelow: "lg" },
    {
      id: "invoice",
      header: "Invoice",
      cell: (row) => (
        <Link href={paths.delivery(row.id)} className="font-medium whitespace-nowrap text-ink hover:underline">
          {row.number}
        </Link>
      ),
      sortValue: (row) => row.number,
    },
    ...(tab === "exchanges"
      ? ([
          { id: "total", header: "Total Amount", cell: (row) => formatAmount(row.totalAmount), className: "text-right tabular-nums", sortValue: (row) => row.totalAmount },
          { id: "returned", header: "Taken Back", cell: (row) => formatAmount(row.returnAmount), className: "text-right tabular-nums" },
          { id: "pending", header: "Pending Amount", cell: (row) => formatAmount(row.pendingAmount), className: "text-right tabular-nums", sortValue: (row) => row.pendingAmount },
        ] satisfies Column<DeliveryListRow>[])
      : ([
          { id: "vat", header: "VAT Challan No", cell: (row) => text(row.vatChallanNo), hideBelow: "lg" },
          { id: "challan", header: "Challan No", cell: (row) => <span className="whitespace-nowrap">{text(row.challanNo)}</span> },
          { id: "vehicle", header: "Vehicle No", cell: (row) => text(row.vehicleNo), hideBelow: "lg" },
        ] satisfies Column<DeliveryListRow>[])),
    { id: "group", header: "Customer Group", cell: (row) => text(row.customerGroup), hideBelow: "lg" },
    { id: "code", header: "Customer Code", cell: (row) => row.customerCode, hideBelow: "md" },
    { id: "customer", header: "Customer", cell: (row) => row.customerName, sortValue: (row) => row.customerName },
    { id: "outlet", header: "Project/Outlet/Ref", cell: (row) => text(row.refProjectOutlet), hideBelow: "lg" },
    { id: "ship", header: "Shipping Address", cell: (row) => <span className="line-clamp-2 min-w-40">{text(row.shippingAddress)}</span>, hideBelow: "lg" },
    { id: "zone", header: "Zone", cell: (row) => text(row.zone), hideBelow: "lg" },
    { id: "route", header: "Route", cell: (row) => text(row.route), hideBelow: "lg" },
    { id: "section", header: "Section", cell: (row) => text(row.section), hideBelow: "lg" },
    { id: "po", header: "Ref Customer PO", cell: (row) => text(row.refCustomerPo), hideBelow: "lg" },
    { id: "payment", header: "Payment", cell: (row) => PAYMENT_METHOD_LABELS[row.paymentMethod], hideBelow: "lg" },
    ...(tab === "exchanges"
      ? []
      : ([{ id: "amount", header: "Amount", cell: (row) => formatAmount(row.totalAmount), className: "text-right tabular-nums", sortValue: (row) => row.totalAmount }] satisfies Column<DeliveryListRow>[])),
  ];

  const simple = tab === "challans";
  return (
    <>
      <FilterForm
        onSubmit={view}
        error={filterError}
        loading={list.loading}
        extra={
          tab === "deliveries" && (
            <CheckboxField label="Is Deleted" checked={filters.deleted} onChange={(event) => setFilters({ ...filters, deleted: event.target.checked })} />
          )
        }
      >
        <SelectField label="Office" options={filterLists.offices} {...field("officeId")} />
        {!simple && tab !== "exchanges" && <SelectField label="Filter By Type" options={options(DELIVERY_TYPES, DELIVERY_TYPE_LABELS)} {...field("deliveryType")} />}
        {!simple && <SelectField label="Confirmation Status" options={options(CONFIRMATIONS, CONFIRMATION_LABELS)} {...field("confirmation")} />}
        {!simple && <SelectField label="Customer Group" options={filterLists.groups} {...field("customerGroupId")} />}
        {!simple && <SelectField label="Territory" options={filterLists.areaOptions("TERRITORY")} {...field("territoryId")} />}
        {tab === "deliveries" && <SelectField label="Zone" options={filterLists.areaOptions("ZONE")} {...field("zoneId")} />}
        {tab === "deliveries" && <SelectField label="Route" options={filterLists.areaOptions("ROUTE")} {...field("routeId")} />}
        {tab === "deliveries" && <SelectField label="Section" options={filterLists.areaOptions("SECTION")} {...field("sectionId")} />}
        <TextField label="From Date" type="date" {...field("from")} />
        <TextField label="To Date" type="date" {...field("to")} />
        {!simple && <SelectField label="Payment Method" options={options(PAYMENT_METHODS, PAYMENT_METHOD_LABELS)} {...field("paymentMethod")} />}
        {tab === "deliveries" && <TextField label="Vehicle No" {...field("vehicleNo")} />}
      </FilterForm>
      {list.error ? (
        <ErrorState message={errorMessage(list.error)} onRetry={list.reload} />
      ) : !data ? (
        <LoadingState />
      ) : (
        <div aria-busy={list.loading} className={list.loading ? "opacity-60 transition-opacity" : undefined}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-line px-4 py-2.5 text-sm">
            <span className="text-ink-muted">
              {tab === "exchanges" ? "Exchanges" : "Deliveries"} <span className="font-medium text-ink tabular-nums">{data.totalCount}</span>
            </span>
            <span className="text-ink-muted">
              Total <span className="font-semibold text-ink tabular-nums">{formatAmount(data.totalAmount)}</span>
            </span>
            {tab === "exchanges" && (
              <span className="text-ink-muted">
                Pending <span className="font-semibold text-ink tabular-nums">{formatAmount(data.pendingAmount)}</span>
              </span>
            )}
            {data.totalCount > data.rows.length && (
              <span className="text-xs text-warning">Showing the latest {data.rows.length}; narrow the filters to see the rest.</span>
            )}
          </div>
          <DataTable
            rows={data.rows}
            columns={columns}
            getRowId={(row) => row.id}
            getRowLabel={(row) => row.number}
            rowHref={(row) => paths.delivery(row.id)}
            search={{
              placeholder: "Search invoice, challan, SO, customer",
              match: (row, needle) =>
                `${row.number} ${row.challanNo ?? ""} ${row.orderNumber ?? ""} ${row.customerName} ${row.customerCode}`.toLowerCase().includes(needle),
            }}
            emptyState={<EmptyState title={tab === "exchanges" ? "No exchanges in this range" : "No deliveries in this range"} />}
          />
        </div>
      )}
    </>
  );
}
