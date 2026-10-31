"use client";

import { Ban, Download, EllipsisVertical, Eye, History, Info, Pencil, Plus, Printer, RefreshCw, Repeat, Search, Truck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu, type MenuItem } from "@/components/ui/dropdown-menu";
import { CONTROL, CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/form-field";
import { Card, ErrorState, LoadingState } from "@/components/ui/section";
import { EmptyState } from "@/features/sales/components/EmptyState";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatAmount } from "../../dashboard/lib/format";
import { formatDay, useToday } from "../../lib/use-today";
import type { AreaKind, CustomerOption, SetupLookups } from "../../masters/schemas/masters.schema";
import { fetchCustomers, fetchSalesLookups, fetchSetupLookups } from "../../masters/services/masters.api";
import { SearchPick } from "../../components/SearchPick";
import { ORDER_TYPE_LABELS, PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "../../orders/schemas/order.schema";
import { changeOrderStatus } from "../../orders/services/order.api";
import { paths } from "../../paths";
import { SimpleMastersPanel } from "../../setup/components/SimpleMastersPanel";
import {
  APPROVED_ORDER_STATUSES,
  APPROVED_ORDER_STATUS_LABELS,
  CONFIRMATIONS,
  CONFIRMATION_LABELS,
  DELIVERY_PAGE_SIZES,
  DELIVERY_TYPES,
  DELIVERY_TYPE_LABELS,
  approvedOrderQuerySchema,
  deliveryListQuerySchema,
  type ApprovedOrderQuery,
  type ApprovedOrderRow,
  type DeliveryListQuery,
  type DeliveryListRow,
} from "../schemas/delivery.schema";
import { addPendingNote, challanPdfUrl, downloadDeliveryExcel, fetchApprovedOrders, fetchDeliveries, fetchPendingNotes, setPendingReason } from "../services/delivery.api";

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
/** Customer filter choices as in Managerium: "Name (mobile)", the code when there is no mobile. */
const customerOptions = (customers: CustomerOption[] | undefined) =>
  (customers ?? []).map((customer) => ({ id: customer.id, label: `${customer.name} (${customer.phone || customer.code})` }));

/** Lists open from the 1st of the current month ("YYYY-MM-01"). */
const monthStart = (today: string) => `${today.slice(0, 7)}-01`;

// Empty cells stay blank, as in Managerium.
const text = (value: string | null) => value ?? "";

/** Compact, vertically centred rows like Managerium. */
const compact = <T,>(columns: Column<T>[]) => columns.map((column) => ({ ...column, className: cn("py-1.5! align-middle!", column.className) }));
type Query = Record<string, unknown>;

/** `value` once it has stopped changing for 400 ms. */
export function useDebounced(value: string) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), 400);
    return () => clearTimeout(timer);
  }, [value]);
  return settled;
}

/** Tells the page head the query in use (for Excel), whenever it changes. */
function useReportQuery(query: Query, onQuery: (query: Query | null) => void) {
  const key = JSON.stringify(query);
  useEffect(() => {
    onQuery(JSON.parse(key) as Query);
    return () => onQuery(null);
  }, [key, onQuery]);
}

/** /sales/deliveries?tab=… — read the tab inside <Suspense> (search params are request-time). */
export function DeliveryWorkspaceView() {
  const today = useToday();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab: Tab = isTab(params.get("tab")) ? (params.get("tab") as Tab) : "approved";
  const toast = useToast();
  const [search, setSearch] = useState("");
  const searched = useDebounced(search.trim());
  const [exportQuery, setExportQuery] = useState<Query | null>(null);
  const [exporting, setExporting] = useState(false);

  async function exportExcel() {
    if (!exportQuery) return;
    setExporting(true);
    try {
      await downloadDeliveryExcel(tab, exportQuery);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setExporting(false);
    }
  }

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
            <label className="relative w-56">
              <span className="sr-only">Search</span>
              <Search aria-hidden="true" className="pointer-events-none absolute top-1.5 left-2 size-4 text-ink-faint" />
              <input type="search" value={search} placeholder="Search…" onChange={(event) => setSearch(event.target.value)} className={cn(CONTROL, "h-7 pl-7")} />
            </label>
            <Button variant="primary" onClick={exportExcel} loading={exporting} disabled={!exportQuery}>
              <Download aria-hidden="true" />
              Excel
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
            <ApprovedOrdersTab key="approved" today={today} search={searched} onQuery={setExportQuery} />
          ) : (
            <DeliveriesTab key={tab} tab={tab} today={today} search={searched} onQuery={setExportQuery} />
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
    // Sales Setup regions etc. filter every territory below them.
    ...(kind === "TERRITORY" ? (setup.data?.territoryGroups ?? []).map((node) => ({ value: node.id, label: `${node.layer}: ${node.name} (all)` })) : []),
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

type ApprovedFilters = Record<"officeId" | "customerGroupId" | "territoryId" | "status" | "zoneId" | "routeId" | "sectionId" | "from" | "to" | "salesPersonId" | "customerId", string>;

function ApprovedOrdersTab({ today, search, onQuery }: { today: string; search: string; onQuery: (query: Query | null) => void }) {
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
    from: monthStart(today),
    to: today,
    salesPersonId: "",
    customerId: "",
  };
  const [filters, setFilters] = useState(initial);
  const [query, setQuery] = useState<ApprovedOrderQuery>({ from: initial.from, to: initial.to });
  const [filterError, setFilterError] = useState<string>();
  const effective: ApprovedOrderQuery = { ...query, ...(search ? { search } : {}) };
  const list = useResource(`approved:${JSON.stringify(effective)}`, () => fetchApprovedOrders(effective), { refreshOnFocus: true });
  useReportQuery(effective, onQuery);
  const [reasonFor, setReasonFor] = useState<ApprovedOrderRow | null>(null);
  const [closing, setClosing] = useState<ApprovedOrderRow | null>(null);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [reasonsOpen, setReasonsOpen] = useState(false);
  const firstUnit = filterLists.lookups.data?.offices[0]?.businessUnitId;
  // Customer search: customers of the chosen office's business unit (else the first one).
  const customerUnit = filterLists.lookups.data?.offices.find((office) => office.id === filters.officeId)?.businessUnitId ?? firstUnit;
  const customers = useResource(customerUnit ? `customers:${customerUnit}` : null, () => fetchCustomers(customerUnit!));
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

  const [savingReason, setSavingReason] = useState<string | null>(null);
  async function changeReason(row: ApprovedOrderRow, reasonId: string) {
    setSavingReason(row.id);
    try {
      await setPendingReason(row.id, reasonId || null);
      const name = filterLists.setup.data?.deliveryReasons.find((reason) => reason.id === reasonId)?.name ?? null;
      list.mutate((current) => (current ?? []).map((candidate) => (candidate.id === row.id ? { ...candidate, pendingReasonId: reasonId || null, pendingReasonName: name } : candidate)));
      toast.success(reasonId ? `Pending reason saved for ${row.number}.` : `Pending reason cleared for ${row.number}.`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSavingReason(null);
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

  const rows = list.data;

  const columns: Column<ApprovedOrderRow>[] = [
    { id: "sl", header: "SL", cell: (_row, index) => <span className="text-ink-faint tabular-nums">{index + 1}</span>, className: "w-10" },
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
        <span className={cn("font-medium whitespace-nowrap", row.status === "APPROVED" ? "text-success" : "text-accent-strong")}>
          {APPROVED_ORDER_STATUS_LABELS[row.status]}
          {row.status === "PARTIALLY_DELIVERED" && ` ${row.deliveredPercent}%`}
        </span>
      ),
      // Not sortable, so the list opens newest SO date first (the first sortable column).
    },
    { id: "date", header: "SO Date", cell: (row) => <DayCell day={row.orderDate} />, sortValue: (row) => row.orderDate, className: "whitespace-nowrap" },
    { id: "exp", header: "Exp. Delivery Date", cell: (row) => <DayCell day={row.expectedDeliveryDate} />, sortValue: (row) => row.expectedDeliveryDate, className: "whitespace-nowrap" },
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
    { id: "customer", header: "Customer Name", cell: (row) => <span className="line-clamp-2 min-w-32">{row.customerName}</span>, sortValue: (row) => row.customerName },
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
      className: "min-w-64",
      // As in Managerium: pick one of the business unit's reasons ("Create Reason" adds more).
      cell: (row) => (
        <span className="flex items-center gap-1">
          <select
            aria-label={`Pending reason of ${row.number}`}
            value={row.pendingReasonId ?? ""}
            disabled={savingReason === row.id}
            onChange={(event) => void changeReason(row, event.target.value)}
            title={row.pendingReasonName ?? undefined}
            className={cn(CONTROL, "h-7 w-52 shrink-0", row.pendingReasonId ? "text-warning" : "text-ink-faint")}
          >
            <option value="">Select a Reason</option>
            {(filterLists.setup.data?.deliveryReasons ?? [])
              .filter((reason) => reason.businessUnitId === row.businessUnitId)
              .map((reason) => (
                <option key={reason.id} value={reason.id} className="text-ink">
                  {reason.name}
                </option>
              ))}
          </select>
          <Button variant="ghost" size="icon" aria-label={`Reason history of ${row.number}`} title="Write a reason / previous reasons" onClick={() => setReasonFor(row)}>
            <History />
          </Button>
        </span>
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
        <SearchPick
          key={customers.data?.length ?? 0}
          label="Customer"
          placeholder="Select/Search Customer"
          options={customerOptions(customers.data)}
          minChars={0}
          selectedId={filters.customerId}
          onPick={(id) => setFilters((current) => ({ ...current, customerId: id ?? "" }))}
        />
        <SelectField label="Order By" options={filterLists.persons} {...field("salesPersonId")} />
      </FilterForm>
      {list.error ? (
        <ErrorState message={errorMessage(list.error)} onRetry={list.reload} />
      ) : !rows ? (
        <LoadingState />
      ) : (
        <DataTable
          rows={rows}
          columns={compact(columns)}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.number}
          pages={DELIVERY_PAGE_SIZES}
          emptyState={<EmptyState title="No approved orders waiting for delivery" />}
        />
      )}

      {reasonFor && (
        <PendingReasonDialog
          key={reasonFor.id}
          order={reasonFor}
          onClose={() => setReasonFor(null)}
          onSaved={() => {
            // A typed reason becomes one of the business unit's reasons: refresh both lists.
            list.reload();
            filterLists.setup.reload();
          }}
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
  "officeId" | "deliveryType" | "confirmation" | "customerGroupId" | "territoryId" | "zoneId" | "routeId" | "sectionId" | "from" | "to" | "paymentMethod" | "vehicleNo" | "customerId",
  string
> & { deleted: boolean };

function DeliveriesTab({ tab, today, search, onQuery }: { tab: Exclude<Tab, "approved">; today: string; search: string; onQuery: (query: Query | null) => void }) {
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
    from: monthStart(today),
    to: today,
    paymentMethod: "",
    vehicleNo: "",
    customerId: "",
    deleted: false,
  };
  const [filters, setFilters] = useState(initial);
  const toQuery = (values: ListFilters): DeliveryListQuery =>
    Object.fromEntries(Object.entries({ ...values, deleted: values.deleted ? "true" : "" }).filter(([, value]) => value)) as DeliveryListQuery;
  const [query, setQuery] = useState<DeliveryListQuery>(toQuery(initial));
  const [paging, setPaging] = useState({ page: 1, pageSize: 50 });
  const [filterError, setFilterError] = useState<string>();
  const filtered: DeliveryListQuery = { ...query, ...(search ? { search } : {}) };
  const list = useResource(`deliveries:${JSON.stringify(filtered)}:${paging.page}:${paging.pageSize}`, () => fetchDeliveries({ ...filtered, ...paging }), { refreshOnFocus: true });
  // Excel exports every matching row, not just this page.
  useReportQuery(filtered, onQuery);
  const [searchedFor, setSearchedFor] = useState(search);
  if (searchedFor !== search) {
    setSearchedFor(search);
    setPaging((current) => ({ ...current, page: 1 }));
  }

  const firstUnit = filterLists.lookups.data?.offices[0]?.businessUnitId;
  const customerUnit = filterLists.lookups.data?.offices.find((office) => office.id === filters.officeId)?.businessUnitId ?? firstUnit;
  const customers = useResource(customerUnit && tab !== "challans" ? `customers:${customerUnit}` : null, () => fetchCustomers(customerUnit!));

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
    setPaging((current) => ({ ...current, page: 1 }));
    if (JSON.stringify(next) === JSON.stringify(query)) list.reload();
    else setQuery(next);
  }

  const data = list.data;
  const challans = tab === "challans";
  const viewHref = (row: DeliveryListRow) => (challans ? paths.deliveryChallan(row.id) : paths.delivery(row.id));
  const printItems = (row: DeliveryListRow): MenuItem[] => [
    { label: "Challan Details", icon: <Eye />, href: paths.deliveryChallan(row.id) },
    { label: "Delivery Challan (PDF)", icon: <Printer />, onSelect: () => window.open(challanPdfUrl(row.id), "_blank", "noopener") },
    { label: "Challan (with header)", icon: <Printer />, href: paths.printDelivery(row.id, "challan") },
    { label: "Challan (without header)", icon: <Printer />, href: paths.printDelivery(row.id, "challan-plain") },
    { label: "Mushak 6.3", icon: <Printer />, href: paths.printDelivery(row.id, "mushak") },
    { label: "Sales Invoice", icon: <Printer />, href: paths.printDelivery(row.id, "invoice") },
  ];
  const offset = (paging.page - 1) * paging.pageSize;

  const sl: Column<DeliveryListRow> = { id: "sl", header: "SL", cell: (_row, index) => <span className="text-ink-faint tabular-nums">{offset + index + 1}</span>, className: "w-10" };
  const actions: Column<DeliveryListRow> = {
    id: "actions",
    header: "Action",
    cell: (row) => {
      const editable = !row.deleted && row.confirmation === "PENDING";
      return (
        <span className="flex items-center gap-0.5">
          <Link href={viewHref(row)} aria-label={`View ${row.number}`} title={challans ? "Challan Details" : "Delivery Details"} className={buttonClasses("ghost", "icon")}>
            <Eye />
          </Link>
          {editable ? (
            <Link href={paths.editDelivery(row.id)} aria-label={`Edit ${row.number}`} title="Edit" className={buttonClasses("ghost", "icon")}>
              <Pencil />
            </Link>
          ) : (
            <span aria-hidden="true" title="Confirmed deliveries cannot be edited" className={cn(buttonClasses("ghost", "icon"), "opacity-30")}>
              <Pencil />
            </span>
          )}
          <DropdownMenu trigger={<EllipsisVertical />} triggerLabel={`Print ${row.number}`} triggerClassName={buttonClasses("ghost", "icon")} items={printItems(row)} />
        </span>
      );
    },
  };
  const typeCol: Column<DeliveryListRow> = { id: "type", header: "Type", cell: (row) => <span className="text-success">{DELIVERY_TYPE_LABELS[row.deliveryType]}</span> };
  const confirmationCol: Column<DeliveryListRow> = {
    id: "confirmation",
    header: "Confirmation",
    cell: (row) =>
      row.deleted ? (
        <span className="font-medium text-danger">Deleted</span>
      ) : (
        <span className={cn("font-medium", row.confirmation === "CONFIRMED" ? "text-success" : "text-warning")}>{CONFIRMATION_LABELS[row.confirmation]}</span>
      ),
    // Not sortable, so the list opens newest delivery date first (the first sortable column).
  };
  const dateCol: Column<DeliveryListRow> = { id: "date", header: "Delivery Date", cell: (row) => <DayCell day={row.deliveryDate} />, sortValue: (row) => row.deliveryDate, className: "whitespace-nowrap" };
  const orderDateCol: Column<DeliveryListRow> = { id: "orderDate", header: "Order Date", cell: (row) => (row.orderDate ? formatDay(row.orderDate) : ""), className: "whitespace-nowrap", hideBelow: "lg" };
  const soCol: Column<DeliveryListRow> = {
    id: "so",
    header: "SO No",
    cell: (row) =>
      row.salesOrderId ? (
        <Link href={paths.order(row.salesOrderId)} className="whitespace-nowrap text-ink hover:underline">
          {row.orderNumber}
        </Link>
      ) : (
        ""
      ),
    hideBelow: "md",
  };
  const salesForceCol: Column<DeliveryListRow> = { id: "sf", header: tab === "exchanges" ? "Sales By" : "Sales Force", cell: (row) => <span className="line-clamp-3 min-w-32">{text(row.salesPersonName)}</span>, hideBelow: "lg" };
  const invoiceCol: Column<DeliveryListRow> = {
    id: "invoice",
    header: "Invoice",
    cell: (row) => (
      <Link href={viewHref(row)} className="font-medium whitespace-nowrap text-ink hover:underline">
        {row.number}
      </Link>
    ),
    sortValue: (row) => row.number,
  };
  const challanCol: Column<DeliveryListRow> = { id: "challan", header: "Challan No", cell: (row) => <span className="whitespace-nowrap">{text(row.challanNo)}</span> };
  const groupCol: Column<DeliveryListRow> = { id: "group", header: "Customer Group", cell: (row) => text(row.customerGroup), hideBelow: "lg" };
  const codeCol: Column<DeliveryListRow> = { id: "code", header: "Customer Code", cell: (row) => row.customerCode, hideBelow: "md" };
  const customerCol: Column<DeliveryListRow> = { id: "customer", header: "Customer", cell: (row) => <span className="line-clamp-3 min-w-36">{row.customerName}</span>, sortValue: (row) => row.customerName };
  const outletCol: Column<DeliveryListRow> = { id: "outlet", header: "Project/Outlet/Ref", cell: (row) => text(row.refProjectOutlet), hideBelow: "lg" };
  const shipCol: Column<DeliveryListRow> = { id: "ship", header: "Shipping Address", cell: (row) => <span className="line-clamp-3 min-w-44">{text(row.shippingAddress)}</span>, hideBelow: "lg" };
  const paymentCol: Column<DeliveryListRow> = { id: "payment", header: "Payment Method", cell: (row) => PAYMENT_METHOD_LABELS[row.paymentMethod], hideBelow: "lg" };
  const money = (id: string, header: string, pick: (row: DeliveryListRow) => number): Column<DeliveryListRow> => ({
    id,
    header,
    cell: (row) => formatAmount(pick(row)),
    sortValue: pick,
    className: "text-right tabular-nums",
  });

  const columns: Column<DeliveryListRow>[] =
    tab === "exchanges"
      ? [sl, dateCol, orderDateCol, soCol, invoiceCol, challanCol, groupCol, codeCol, customerCol, outletCol, shipCol, money("total", "Total Amount", (row) => row.totalAmount), money("returned", "Return Amount", (row) => row.returnAmount), money("paid", "Paid Amount", (row) => row.paidAmount), money("pending", "Pending Amount", (row) => row.pendingAmount), salesForceCol, paymentCol, confirmationCol, typeCol, actions]
      : [
          sl,
          actions,
          typeCol,
          confirmationCol,
          dateCol,
          orderDateCol,
          soCol,
          salesForceCol,
          invoiceCol,
          { id: "vat", header: "Vat Challan No", cell: (row) => text(row.vatChallanNo), hideBelow: "lg" },
          challanCol,
          { id: "vehicle", header: "Vehicle No", cell: (row) => <span className="whitespace-nowrap">{row.vehicleNo ?? ""}</span>, hideBelow: "lg" },
          groupCol,
          codeCol,
          customerCol,
          outletCol,
          shipCol,
          { id: "zone", header: "Zone", cell: (row) => row.zone ?? "", hideBelow: "lg" },
          { id: "route", header: "Route", cell: (row) => row.route ?? "", hideBelow: "lg" },
          { id: "section", header: "Section", cell: (row) => row.section ?? "", hideBelow: "lg" },
          { id: "po", header: "Ref Customer PO", cell: (row) => text(row.refCustomerPo), hideBelow: "lg" },
          { id: "poDate", header: "Ref Customer PO Date", cell: (row) => (row.refCustomerPoDate ? formatDay(row.refCustomerPoDate) : ""), hideBelow: "lg" },
          { id: "refInvoice", header: "Ref Invoice", cell: (row) => text(row.refInvoice), hideBelow: "lg" },
          paymentCol,
          money("amount", "Amount", (row) => row.totalAmount),
        ];

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
        {!challans && (
          <SelectField
            label="Filter By Type"
            options={options(DELIVERY_TYPES, DELIVERY_TYPE_LABELS)}
            disabled={tab === "exchanges"}
            {...field("deliveryType")}
          />
        )}
        {!challans && <SelectField label="Confirmation Status" options={options(CONFIRMATIONS, CONFIRMATION_LABELS)} {...field("confirmation")} />}
        {!challans && <SelectField label="Customer Group" options={filterLists.groups} {...field("customerGroupId")} />}
        {tab === "deliveries" && (
          <SearchPick
            key={customers.data?.length ?? 0}
            label="Customer"
            placeholder="Select/Search Customer"
            options={customerOptions(customers.data)}
            minChars={0}
            selectedId={filters.customerId}
            onPick={(id) => setFilters((current) => ({ ...current, customerId: id ?? "" }))}
          />
        )}
        {!challans && <SelectField label="Territory" options={filterLists.areaOptions("TERRITORY")} {...field("territoryId")} />}
        {tab === "deliveries" && <SelectField label="Zone" options={filterLists.areaOptions("ZONE")} {...field("zoneId")} />}
        {tab === "deliveries" && <SelectField label="Route" options={filterLists.areaOptions("ROUTE")} {...field("routeId")} />}
        {tab === "deliveries" && <SelectField label="Section" options={filterLists.areaOptions("SECTION")} {...field("sectionId")} />}
        <TextField label="From Date" type="date" {...field("from")} />
        <TextField label="To Date" type="date" {...field("to")} />
        {!challans && <SelectField label="Payment Method" options={options(PAYMENT_METHODS, PAYMENT_METHOD_LABELS)} {...field("paymentMethod")} />}
        {tab === "deliveries" && <TextField label="Vehicle No" placeholder="Vehicle No" {...field("vehicleNo")} />}
      </FilterForm>
      {list.error ? (
        <ErrorState message={errorMessage(list.error)} onRetry={list.reload} />
      ) : !data ? (
        <LoadingState />
      ) : (
        <div aria-busy={list.loading} className={list.loading ? "opacity-60 transition-opacity" : undefined}>
          <DataTable
            rows={data.rows}
            columns={compact(columns)}
            getRowId={(row) => row.id}
            getRowLabel={(row) => row.number}
            rowHref={viewHref}
            footer={(rows) =>
              tab === "exchanges"
                ? {
                    customer: "Total",
                    total: formatAmount(rows.reduce((sum, row) => sum + row.totalAmount, 0)),
                    returned: formatAmount(rows.reduce((sum, row) => sum + row.returnAmount, 0)),
                    paid: formatAmount(rows.reduce((sum, row) => sum + row.paidAmount, 0)),
                    pending: formatAmount(rows.reduce((sum, row) => sum + row.pendingAmount, 0)),
                  }
                : { customer: "Total", amount: formatAmount(rows.reduce((sum, row) => sum + row.totalAmount, 0)) }
            }
            serverPage={{
              page: paging.page,
              pageSize: paging.pageSize,
              total: data.totalCount,
              sizes: DELIVERY_PAGE_SIZES,
              onChange: (page, pageSize) => setPaging({ page, pageSize }),
            }}
            emptyState={<EmptyState title={tab === "exchanges" ? "No exchanges in this range" : "No deliveries in this range"} />}
          />
        </div>
      )}
    </>
  );
}

/** Date with the info icon, as in Managerium's lists. */
export function DayCell({ day }: { day: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Info aria-hidden="true" className="size-3.5 text-ink-faint" />
      {formatDay(day)}
    </span>
  );
}

/** Pending Reason: record why the order waits, with every earlier reason. */
function PendingReasonDialog({ order, onClose, onSaved }: { order: ApprovedOrderRow; onClose: () => void; onSaved: (reason: string) => void }) {
  const toast = useToast();
  const notes = useResource(`pending-notes:${order.id}`, () => fetchPendingNotes(order.id));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    const value = reason.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      const updated = await addPendingNote(order.id, value);
      notes.mutate(() => updated);
      onSaved(value);
      setReason("");
      toast.success(`Pending reason saved for ${order.number}.`);
    } catch (error) {
      toast.error(errorMessage(error));
      notes.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      title={`Pending Reason · ${order.number}`}
      onClose={busy ? () => undefined : onClose}
      footer={
        <Button variant="ghost" className="text-danger" onClick={onClose} disabled={busy}>
          CLOSE
        </Button>
      }
    >
      <form onSubmit={save} className="flex items-end gap-2">
        <TextAreaField label="Pending Reason" className="min-w-0 flex-1" rows={2} maxLength={100} value={reason} onChange={(event) => setReason(event.target.value)} />
        <Button type="submit" variant="primary" loading={busy} disabled={!reason.trim()}>
          Save
        </Button>
      </form>
      <div className="mt-4">
        <h3 className="text-sm font-semibold text-ink">Previous Pending Reason</h3>
        {notes.error ? (
          <ErrorState message={errorMessage(notes.error)} onRetry={notes.reload} />
        ) : !notes.data ? (
          <LoadingState />
        ) : notes.data.length === 0 ? (
          <p className="mt-1 text-sm text-ink-muted">No reason recorded yet.</p>
        ) : (
          <ol className="mt-1 flex flex-col gap-1 text-sm">
            {notes.data.map((note, index) => (
              <li key={note.id} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold text-ink">{index + 1}.</span>
                <span className="text-ink">{note.reason}</span>
                <span className="text-xs text-ink-faint">
                  {note.createdByName ?? ""} · {formatDay(note.createdAt.slice(0, 10))}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Dialog>
  );
}
