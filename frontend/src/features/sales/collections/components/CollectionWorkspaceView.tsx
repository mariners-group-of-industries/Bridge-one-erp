"use client";

import { Download, Eye, FilePlus2, HandCoins, Printer, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { CheckboxField, SelectField, TextField } from "@/components/ui/form-field";
import { Card, EmptyState, ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatAmount } from "../../dashboard/lib/format";
import { FilterForm, useFilterLookups } from "../../deliveries/components/DeliveryWorkspaceView";
import { downloadCsv } from "../../lib/csv";
import { printTable } from "../../lib/print-table";
import { addDays, formatDay, useToday } from "../../lib/use-today";
import { fetchCustomers } from "../../masters/services/masters.api";
import { paths } from "../../paths";
import {
  COLLECTION_METHOD_LABELS,
  collectionListQuerySchema,
  dueInvoiceQuerySchema,
  type AllocationRow,
  type BillRow,
  type CollectionListQuery,
  type CollectionRow,
  type DueInvoice,
  type DueInvoiceQuery,
  type DueListRow,
  type LedgerRow,
} from "../schemas/collection.schema";
import { fetchBills, fetchCollections, fetchDueInvoices, fetchDueList, fetchLedger } from "../services/collection.api";

type Tab = "due" | "bills" | "collected" | "due-report" | "ledger" | "advance";
const TABS: { id: Tab; label: string }[] = [
  { id: "due", label: "Due List" },
  { id: "bills", label: "Due Bill" },
  { id: "collected", label: "Collected Invoice" },
  { id: "due-report", label: "Due Invoice Report" },
  { id: "ledger", label: "Customer Sales vs Ledger Balance" },
  { id: "advance", label: "Advance Collection" },
];
const isTab = (value: string | null): value is Tab => TABS.some((tab) => tab.id === value);

/** Rows of the current tab for Excel and PDF. */
interface TableExport {
  name: string;
  title: string;
  headers: string[];
  rows: (string | number | null)[][];
}

const all = { value: "", label: "All" };
const text = (value: string | null) => value ?? "N/A";
const sum = <T,>(rows: readonly T[], pick: (row: T) => number) => rows.reduce((total, row) => total + pick(row), 0);
const amountCell = (value: number) => <span className={cn("tabular-nums", value < 0 && "text-danger")}>{formatAmount(value)}</span>;
const sl = <T,>(): Column<T> => ({ id: "sl", header: "SL", cell: (_row, index) => <span className="text-ink-faint tabular-nums">{index + 1}</span>, className: "w-10" });

/** /sales/collections?tab=… — read the tab inside <Suspense> (search params are request-time). */
export function CollectionWorkspaceView() {
  const today = useToday();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const tab: Tab = isTab(params.get("tab")) ? (params.get("tab") as Tab) : "due";
  const [table, setTable] = useState<TableExport | null>(null);

  return (
    <PageContainer className="max-w-none">
      <PageHead
        title="Sales Collection"
        actions={
          <>
            <Button onClick={() => table && downloadCsv(`${table.name}-${today}.csv`, table.headers, table.rows)} disabled={!table}>
              <Download aria-hidden="true" />
              Excel
            </Button>
            <Button onClick={() => table && !printTable(table.title, table.headers, table.rows) && toast.error("Allow pop-ups to print or save as PDF.")} disabled={!table}>
              <Printer aria-hidden="true" />
              PDF
            </Button>
            <Link href={paths.newAdvance} className={buttonClasses("secondary")}>
              <Wallet aria-hidden="true" />
              Advance
            </Link>
            <Link href={paths.newBill()} className={buttonClasses("secondary")}>
              <FilePlus2 aria-hidden="true" />
              Create Bill
            </Link>
            <Link href={paths.collectByInvoice()} className={buttonClasses("primary")}>
              <HandCoins aria-hidden="true" />
              Collection By Invoice
            </Link>
          </>
        }
      />
      <Card>
        <Tabs<Tab> label="Collection lists" tabs={TABS} value={tab} onChange={(next) => router.replace(`${pathname}?tab=${next}`)}>
          {!today ? (
            <LoadingState />
          ) : tab === "due" ? (
            <DueTab key={tab} today={today} onExport={setTable} />
          ) : tab === "bills" ? (
            <BillsTab key={tab} today={today} onExport={setTable} />
          ) : tab === "collected" || tab === "advance" ? (
            <CollectionsTab key={tab} kind={tab === "advance" ? "ADVANCE" : "INVOICE"} today={today} onExport={setTable} />
          ) : tab === "due-report" ? (
            <DueInvoicesTab key={tab} today={today} onExport={setTable} />
          ) : (
            <LedgerTab key={tab} today={today} onExport={setTable} />
          )}
        </Tabs>
      </Card>
    </PageContainer>
  );
}

/** Hands the current tab's rows to the page head (and clears them on unmount). */
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

function useCustomers() {
  const { lookups } = useFilterLookups();
  const units = [...new Set((lookups.data?.offices ?? []).map((office) => office.businessUnitId))];
  const customers = useResource(units.length ? `collection-customers:${units.join(",")}` : null, async () => (await Promise.all(units.map((unit) => fetchCustomers(unit, true)))).flat());
  return [all, ...(customers.data ?? []).map((customer) => ({ value: customer.id, label: `${customer.code} - ${customer.name}` }))];
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

// ─── Due List ────────────────────────────────────────────────────────────────

function DueTab({ today, onExport }: { today: string; onExport: (table: TableExport | null) => void }) {
  const { offices } = useFilterLookups();
  const [officeId, setOfficeId] = useState("");
  const [query, setQuery] = useState({ officeId: "", asOf: today });
  const list = useResource(`due:${JSON.stringify(query)}`, () => fetchDueList(query));
  const rows = list.data;

  useTableExport(
    rows
      ? {
          name: "due-list",
          title: `Due List as of ${formatDay(today)}`,
          headers: ["SL", "Customer Code", "Customer", "Customer Group", "Territory", "Sales Force", "Invoices", "Due", "Overdue", "Advance", "Ledger"],
          rows: rows.map((row, index) => [index + 1, row.customerCode, row.customerName, row.customerGroup, row.territory, row.salesPersonName, row.invoices, row.due.toFixed(2), row.overdue.toFixed(2), row.advance.toFixed(2), row.ledger.toFixed(2)]),
        }
      : null,
    onExport,
  );

  const columns: Column<DueListRow>[] = [
    sl(),
    { id: "code", header: "Customer Code", cell: (row) => row.customerCode, hideBelow: "md" },
    { id: "customer", header: "Customer Name", cell: (row) => row.customerName, sortValue: (row) => row.customerName },
    { id: "group", header: "Customer Group", cell: (row) => text(row.customerGroup), hideBelow: "lg" },
    { id: "territory", header: "Territory", cell: (row) => text(row.territory), hideBelow: "lg" },
    { id: "by", header: "Sales Force", cell: (row) => text(row.salesPersonName), hideBelow: "lg" },
    { id: "invoices", header: "Invoices", cell: (row) => row.invoices, className: "text-right tabular-nums" },
    { id: "due", header: "Due", cell: (row) => amountCell(row.due), sortValue: (row) => row.due, className: "text-right" },
    { id: "overdue", header: "Overdue", cell: (row) => <span className={cn("tabular-nums", row.overdue > 0 && "text-danger")}>{formatAmount(row.overdue)}</span>, sortValue: (row) => row.overdue, className: "text-right" },
    { id: "advance", header: "Advance", cell: (row) => amountCell(row.advance), className: "text-right", hideBelow: "md" },
    { id: "ledger", header: "Ledger", cell: (row) => amountCell(row.ledger), className: "text-right", hideBelow: "md" },
    {
      id: "actions",
      header: "Action",
      cell: (row) => (
        <span className="flex items-center gap-2 whitespace-nowrap text-sm">
          <Link href={paths.collectByInvoice(row.customerId)} className="text-ink underline underline-offset-2">
            Collect
          </Link>
          <Link href={paths.newBill(row.customerId)} className="text-ink underline underline-offset-2">
            Bill
          </Link>
        </span>
      ),
    },
  ];

  return (
    <>
      <FilterForm
        onSubmit={(event) => {
          event.preventDefault();
          const next = { officeId, asOf: today };
          if (JSON.stringify(next) === JSON.stringify(query)) list.reload();
          else setQuery(next);
        }}
        loading={list.loading}
      >
        <SelectField label="Office" options={offices} value={officeId} onChange={(event) => setOfficeId(event.target.value)} />
      </FilterForm>
      <Results resource={list}>
        {(data) => (
          <DataTable
            rows={data}
            columns={columns}
            getRowId={(row) => row.customerId}
            getRowLabel={(row) => row.customerName}
            search={{ placeholder: "Search customer", match: (row, needle) => `${row.customerCode} ${row.customerName}`.toLowerCase().includes(needle) }}
            footer={(shown) => ({
              customer: "Total:",
              due: amountCell(sum(shown, (row) => row.due)),
              overdue: amountCell(sum(shown, (row) => row.overdue)),
              advance: amountCell(sum(shown, (row) => row.advance)),
              ledger: amountCell(sum(shown, (row) => row.ledger)),
            })}
            emptyState={<EmptyState title="No customer owes anything" />}
          />
        )}
      </Results>
    </>
  );
}

// ─── Due Bill ────────────────────────────────────────────────────────────────

function BillsTab({ today, onExport }: { today: string; onExport: (table: TableExport | null) => void }) {
  const { offices } = useFilterLookups();
  const [officeId, setOfficeId] = useState("");
  const [query, setQuery] = useState({ officeId: "", asOf: today });
  const list = useResource(`bills:${JSON.stringify(query)}`, () => fetchBills(query));
  const rows = list.data;

  useTableExport(
    rows
      ? {
          name: "due-bills",
          title: `Due Bills as of ${formatDay(today)}`,
          headers: ["SL", "Bill No", "Bill Date", "Office", "Customer Code", "Customer", "Invoices", "Bill Amount", "Collected", "Due"],
          rows: rows.map((row, index) => [index + 1, row.number, row.billDate, row.officeName, row.customerCode, row.customerName, row.invoices, row.billAmount.toFixed(2), row.collected.toFixed(2), row.due.toFixed(2)]),
        }
      : null,
    onExport,
  );

  const columns: Column<BillRow>[] = [
    sl(),
    {
      id: "number",
      header: "Bill No",
      cell: (row) => (
        <Link href={paths.bill(row.id)} className="font-medium whitespace-nowrap text-ink hover:underline">
          {row.number}
        </Link>
      ),
      sortValue: (row) => row.number,
    },
    { id: "date", header: "Bill Date", cell: (row) => formatDay(row.billDate), sortValue: (row) => row.billDate, className: "whitespace-nowrap" },
    { id: "office", header: "Office", cell: (row) => row.officeName, hideBelow: "lg" },
    { id: "code", header: "Customer Code", cell: (row) => row.customerCode, hideBelow: "md" },
    { id: "customer", header: "Customer", cell: (row) => row.customerName, sortValue: (row) => row.customerName },
    { id: "invoices", header: "Invoices", cell: (row) => row.invoices, className: "text-right tabular-nums" },
    { id: "amount", header: "Bill Amount", cell: (row) => amountCell(row.billAmount), className: "text-right" },
    { id: "collected", header: "Collected", cell: (row) => amountCell(row.collected), className: "text-right" },
    { id: "due", header: "Due", cell: (row) => amountCell(row.due), sortValue: (row) => row.due, className: "text-right" },
    {
      id: "actions",
      header: "Action",
      cell: (row) => (
        <span className="flex items-center gap-0.5">
          <Link href={paths.bill(row.id)} aria-label={`View ${row.number}`} title="View" className={buttonClasses("ghost", "icon")}>
            <Eye />
          </Link>
          <Link href={paths.printBill(row.id)} aria-label={`Print ${row.number}`} title="Print" className={buttonClasses("ghost", "icon")}>
            <Printer />
          </Link>
          <Link href={paths.collectByInvoice(row.customerId, row.id)} aria-label={`Collect ${row.number}`} title="Collect" className={buttonClasses("ghost", "icon")}>
            <HandCoins />
          </Link>
        </span>
      ),
    },
  ];

  return (
    <>
      <FilterForm
        onSubmit={(event) => {
          event.preventDefault();
          const next = { officeId, asOf: today };
          if (JSON.stringify(next) === JSON.stringify(query)) list.reload();
          else setQuery(next);
        }}
        loading={list.loading}
      >
        <SelectField label="Office" options={offices} value={officeId} onChange={(event) => setOfficeId(event.target.value)} />
      </FilterForm>
      <Results resource={list}>
        {(data) => (
          <DataTable
            rows={data}
            columns={columns}
            getRowId={(row) => row.id}
            getRowLabel={(row) => row.number}
            rowHref={(row) => paths.bill(row.id)}
            search={{ placeholder: "Search bill no or customer", match: (row, needle) => `${row.number} ${row.customerName} ${row.customerCode}`.toLowerCase().includes(needle) }}
            footer={(shown) => ({
              customer: "Total:",
              amount: amountCell(sum(shown, (row) => row.billAmount)),
              collected: amountCell(sum(shown, (row) => row.collected)),
              due: amountCell(sum(shown, (row) => row.due)),
            })}
            emptyState={
              <EmptyState title="No bills with dues">
                <Link href={paths.newBill()} className="text-ink underline underline-offset-2">
                  Create a bill
                </Link>
              </EmptyState>
            }
          />
        )}
      </Results>
    </>
  );
}

// ─── Collected Invoice / Advance Collection ──────────────────────────────────

function CollectionsTab({ kind, today, onExport }: { kind: "INVOICE" | "ADVANCE"; today: string; onExport: (table: TableExport | null) => void }) {
  const { offices, persons } = useFilterLookups();
  const customers = useCustomers();
  const advance = kind === "ADVANCE";
  const initial = { officeId: "", salesPersonId: "", customerId: "", from: addDays(today, -30), to: today, cancelled: false };
  const [filters, setFilters] = useState(initial);
  const [details, setDetails] = useState(false);
  const toQuery = (values: typeof initial): CollectionListQuery => ({
    kind,
    ...(Object.fromEntries(Object.entries({ ...values, cancelled: values.cancelled ? "true" : "" }).filter(([, value]) => value)) as Omit<CollectionListQuery, "kind">),
  });
  const [query, setQuery] = useState<CollectionListQuery>(toQuery(initial));
  const [filterError, setFilterError] = useState<string>();
  const list = useResource(`collections:${JSON.stringify(query)}`, () => fetchCollections(query));
  const data = list.data;

  function view(event: FormEvent) {
    event.preventDefault();
    const next = toQuery(filters);
    const parsed = collectionListQuerySchema.safeParse(next);
    if (!parsed.success) return setFilterError(parsed.error.issues[0]?.message);
    setFilterError(undefined);
    if (JSON.stringify(next) === JSON.stringify(query)) list.reload();
    else setQuery(next);
  }

  const title = advance ? "Advance Collection" : "Collected Invoice";
  useTableExport(
    data
      ? details
        ? {
            name: `${advance ? "advance-adjustments" : "collected-invoices"}`,
            title: `${title} (details) ${formatDay(filters.from)} – ${formatDay(filters.to)}`,
            headers: ["SL", "Receipt No", "Receipt Date", "Invoice No", "Invoice Date", "Customer", "Amount"],
            rows: data.allocations.map((row, index) => [index + 1, row.collectionNumber, row.collectionDate, row.invoiceNumber, row.invoiceDate, row.customerName, row.amount.toFixed(2)]),
          }
        : {
            name: advance ? "advance-collections" : "collections",
            title: `${title} ${formatDay(filters.from)} – ${formatDay(filters.to)}`,
            headers: ["SL", "Receipt No", "Date", "Office", "Customer Code", "Customer", "Method", "Reference", "Bank", "Collect By", "Invoices", "Amount", ...(advance ? ["Adjusted", "Balance"] : [])],
            rows: data.rows.map((row, index) => [
              index + 1,
              row.number,
              row.collectionDate,
              row.officeName,
              row.customerCode,
              row.customerName,
              COLLECTION_METHOD_LABELS[row.method],
              row.reference,
              row.bankName,
              row.salesPersonName,
              row.invoices,
              row.amount.toFixed(2),
              ...(advance ? [row.allocated.toFixed(2), row.unallocated.toFixed(2)] : []),
            ]),
          }
      : null,
    onExport,
  );

  const receiptLink = (id: string, number: string) => (
    <Link href={paths.collection(id)} className="font-medium whitespace-nowrap text-ink hover:underline">
      {number}
    </Link>
  );
  const columns: Column<CollectionRow>[] = [
    sl(),
    { id: "number", header: "Receipt No", cell: (row) => receiptLink(row.id, row.number), sortValue: (row) => row.number },
    { id: "date", header: "Date", cell: (row) => formatDay(row.collectionDate), sortValue: (row) => row.collectionDate, className: "whitespace-nowrap" },
    { id: "office", header: "Office", cell: (row) => text(row.officeName), hideBelow: "lg" },
    { id: "code", header: "Customer Code", cell: (row) => row.customerCode, hideBelow: "lg" },
    { id: "customer", header: "Customer", cell: (row) => row.customerName, sortValue: (row) => row.customerName },
    { id: "method", header: "Method", cell: (row) => COLLECTION_METHOD_LABELS[row.method], hideBelow: "md" },
    { id: "reference", header: "Reference", cell: (row) => [row.reference, row.bankName].filter(Boolean).join(" · ") || "N/A", hideBelow: "lg" },
    { id: "by", header: "Collect By", cell: (row) => text(row.salesPersonName), hideBelow: "md" },
    { id: "invoices", header: advance ? "Adjusted Invoices" : "Invoices", cell: (row) => (row.onDelivery ? `${row.invoices} (on delivery)` : row.invoices), className: "text-right tabular-nums", hideBelow: "md" },
    { id: "amount", header: "Amount", cell: (row) => amountCell(row.amount), sortValue: (row) => row.amount, className: "text-right" },
    ...(advance
      ? ([
          { id: "adjusted", header: "Adjusted", cell: (row) => amountCell(row.allocated), className: "text-right" },
          { id: "balance", header: "Balance", cell: (row) => amountCell(row.unallocated), sortValue: (row) => row.unallocated, className: "text-right" },
        ] satisfies Column<CollectionRow>[])
      : []),
  ];
  const detailColumns: Column<AllocationRow & { key: string }>[] = [
    sl(),
    { id: "number", header: "Receipt No", cell: (row) => receiptLink(row.collectionId, row.collectionNumber), sortValue: (row) => row.collectionNumber },
    { id: "date", header: "Receipt Date", cell: (row) => formatDay(row.collectionDate), className: "whitespace-nowrap" },
    {
      id: "invoice",
      header: "Invoice No",
      cell: (row) => (
        <Link href={paths.delivery(row.deliveryId)} className="whitespace-nowrap text-ink hover:underline">
          {row.invoiceNumber}
        </Link>
      ),
      sortValue: (row) => row.invoiceNumber,
    },
    { id: "invoiceDate", header: "Invoice Date", cell: (row) => formatDay(row.invoiceDate), className: "whitespace-nowrap" },
    { id: "customer", header: "Customer", cell: (row) => row.customerName, sortValue: (row) => row.customerName },
    { id: "amount", header: "Amount", cell: (row) => amountCell(row.amount), sortValue: (row) => row.amount, className: "text-right" },
  ];

  return (
    <>
      <FilterForm
        onSubmit={view}
        error={filterError}
        loading={list.loading}
        extra={
          <>
            <CheckboxField label="Details" checked={details} onChange={(event) => setDetails(event.target.checked)} />
            <CheckboxField label="Cancelled" checked={filters.cancelled} onChange={(event) => setFilters({ ...filters, cancelled: event.target.checked })} />
          </>
        }
      >
        <TextField label="From Date" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
        <TextField label="To Date" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
        {advance ? (
          <SelectField label="Customer" options={customers} value={filters.customerId} onChange={(event) => setFilters({ ...filters, customerId: event.target.value })} />
        ) : (
          <>
            <SelectField label="Office" options={offices} value={filters.officeId} onChange={(event) => setFilters({ ...filters, officeId: event.target.value })} />
            <SelectField label="Collect By" options={persons} value={filters.salesPersonId} onChange={(event) => setFilters({ ...filters, salesPersonId: event.target.value })} />
          </>
        )}
      </FilterForm>
      <Results resource={list}>
        {(result) =>
          details ? (
            <DataTable
              rows={result.allocations.map((row) => ({ ...row, key: `${row.collectionId}:${row.deliveryId}` }))}
              columns={detailColumns}
              getRowId={(row) => row.key}
              getRowLabel={(row) => `${row.collectionNumber} ${row.invoiceNumber}`}
              search={{ placeholder: "Search receipt, invoice, customer", match: (row, needle) => `${row.collectionNumber} ${row.invoiceNumber} ${row.customerName}`.toLowerCase().includes(needle) }}
              footer={(shown) => ({ customer: "Total:", amount: amountCell(sum(shown, (row) => row.amount)) })}
              emptyState={<EmptyState title={advance ? "No advance adjusted in this range" : "No invoices collected in this range"} />}
            />
          ) : (
            <DataTable
              rows={result.rows}
              columns={columns}
              getRowId={(row) => row.id}
              getRowLabel={(row) => row.number}
              rowHref={(row) => paths.collection(row.id)}
              search={{ placeholder: "Search receipt, customer, reference", match: (row, needle) => `${row.number} ${row.customerName} ${row.customerCode} ${row.reference ?? ""}`.toLowerCase().includes(needle) }}
              footer={(shown) => ({
                customer: "Total:",
                amount: amountCell(sum(shown, (row) => row.amount)),
                adjusted: amountCell(sum(shown, (row) => row.allocated)),
                balance: amountCell(sum(shown, (row) => row.unallocated)),
              })}
              emptyState={
                <EmptyState title={advance ? "No advance collections in this range" : "No collections in this range"}>
                  <Link href={advance ? paths.newAdvance : paths.collectByInvoice()} className="text-ink underline underline-offset-2">
                    {advance ? "Take an advance" : "Collect by invoice"}
                  </Link>
                </EmptyState>
              }
            />
          )
        }
      </Results>
    </>
  );
}

// ─── Due Invoice Report ──────────────────────────────────────────────────────

function DueInvoicesTab({ today, onExport }: { today: string; onExport: (table: TableExport | null) => void }) {
  const { offices, persons } = useFilterLookups();
  const customers = useCustomers();
  const initial = { officeId: "", customerId: "", salesPersonId: "", from: addDays(today, -30), to: today, notSubmitted: false };
  const [filters, setFilters] = useState(initial);
  const toQuery = (values: typeof initial): DueInvoiceQuery =>
    ({ asOf: today, ...Object.fromEntries(Object.entries({ ...values, notSubmitted: values.notSubmitted ? "true" : "" }).filter(([, value]) => value)) }) as DueInvoiceQuery;
  const [query, setQuery] = useState<DueInvoiceQuery>(toQuery(initial));
  const [filterError, setFilterError] = useState<string>();
  const list = useResource(`due-invoices:${JSON.stringify(query)}`, () => fetchDueInvoices(query));
  const rows = list.data;

  function view(event: FormEvent) {
    event.preventDefault();
    const next = toQuery(filters);
    const parsed = dueInvoiceQuerySchema.safeParse(next);
    if (!parsed.success) return setFilterError(parsed.error.issues[0]?.message);
    setFilterError(undefined);
    if (JSON.stringify(next) === JSON.stringify(query)) list.reload();
    else setQuery(next);
  }

  useTableExport(
    rows
      ? {
          name: "due-invoices",
          title: `Due Invoice Report ${formatDay(filters.from)} – ${formatDay(filters.to)}`,
          headers: ["SL", "Invoice No", "Challan No", "Invoice Date", "Due Date", "Overdue Days", "Office", "Customer Code", "Customer", "Sales Force", "Invoice Amount", "Returned", "Collected", "Due", "Bill No"],
          rows: rows.map((row, index) => [
            index + 1,
            row.number,
            row.challanNo,
            row.deliveryDate,
            row.dueDate,
            row.overdueDays,
            row.officeName,
            row.customerCode,
            row.customerName,
            row.salesPersonName,
            row.totalAmount.toFixed(2),
            row.returnedAmount.toFixed(2),
            row.collectedAmount.toFixed(2),
            row.due.toFixed(2),
            row.billNumber,
          ]),
        }
      : null,
    onExport,
  );

  const columns: Column<DueInvoice>[] = [
    sl(),
    {
      id: "number",
      header: "Invoice No",
      cell: (row) => (
        <Link href={paths.delivery(row.deliveryId)} className="font-medium whitespace-nowrap text-ink hover:underline">
          {row.number}
        </Link>
      ),
      sortValue: (row) => row.number,
    },
    { id: "challan", header: "Challan No", cell: (row) => <span className="whitespace-nowrap">{text(row.challanNo)}</span>, hideBelow: "lg" },
    { id: "date", header: "Invoice Date", cell: (row) => formatDay(row.deliveryDate), sortValue: (row) => row.deliveryDate, className: "whitespace-nowrap" },
    { id: "dueDate", header: "Due Date", cell: (row) => formatDay(row.dueDate), sortValue: (row) => row.dueDate, className: "whitespace-nowrap", hideBelow: "md" },
    {
      id: "days",
      header: "Overdue Days",
      cell: (row) => <span className={cn("tabular-nums", row.overdueDays > 0 && "text-danger")}>{row.overdueDays}</span>,
      sortValue: (row) => row.overdueDays,
      className: "text-right",
    },
    { id: "customer", header: "Customer", cell: (row) => row.customerName, sortValue: (row) => row.customerName },
    { id: "by", header: "Sales Force", cell: (row) => text(row.salesPersonName), hideBelow: "lg" },
    { id: "amount", header: "Invoice Amount", cell: (row) => amountCell(row.totalAmount), className: "text-right", hideBelow: "md" },
    { id: "returned", header: "Returned", cell: (row) => amountCell(row.returnedAmount), className: "text-right", hideBelow: "lg" },
    { id: "collected", header: "Collected", cell: (row) => amountCell(row.collectedAmount), className: "text-right", hideBelow: "md" },
    { id: "due", header: "Due", cell: (row) => amountCell(row.due), sortValue: (row) => row.due, className: "text-right" },
    {
      id: "bill",
      header: "Bill No",
      cell: (row) =>
        row.billId ? (
          <Link href={paths.bill(row.billId)} className="whitespace-nowrap text-ink hover:underline">
            {row.billNumber}
          </Link>
        ) : (
          <span className="text-ink-faint">Not submitted</span>
        ),
      hideBelow: "md",
    },
  ];

  return (
    <>
      <FilterForm
        onSubmit={view}
        error={filterError}
        loading={list.loading}
        extra={<CheckboxField label="Not Submitted" hint="Not on any bill." checked={filters.notSubmitted} onChange={(event) => setFilters({ ...filters, notSubmitted: event.target.checked })} />}
      >
        <TextField label="From Date" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
        <TextField label="To Date" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
        <SelectField label="Office" options={offices} value={filters.officeId} onChange={(event) => setFilters({ ...filters, officeId: event.target.value })} />
        <SelectField label="Customer" options={customers} value={filters.customerId} onChange={(event) => setFilters({ ...filters, customerId: event.target.value })} />
        <SelectField label="Sales Force" options={persons} value={filters.salesPersonId} onChange={(event) => setFilters({ ...filters, salesPersonId: event.target.value })} />
      </FilterForm>
      <Results resource={list}>
        {(data) => (
          <DataTable
            rows={data}
            columns={columns}
            getRowId={(row) => row.deliveryId}
            getRowLabel={(row) => row.number}
            search={{ placeholder: "Search invoice, challan, customer", match: (row, needle) => `${row.number} ${row.challanNo ?? ""} ${row.customerName} ${row.customerCode}`.toLowerCase().includes(needle) }}
            footer={(shown) => ({
              customer: "Total:",
              amount: amountCell(sum(shown, (row) => row.totalAmount)),
              returned: amountCell(sum(shown, (row) => row.returnedAmount)),
              collected: amountCell(sum(shown, (row) => row.collectedAmount)),
              due: amountCell(sum(shown, (row) => row.due)),
            })}
            emptyState={<EmptyState title="No due invoices in this range" />}
          />
        )}
      </Results>
    </>
  );
}

// ─── Customer Sales vs Ledger Balance ────────────────────────────────────────

function LedgerTab({ today, onExport }: { today: string; onExport: (table: TableExport | null) => void }) {
  const list = useResource(`ledger:${today}`, () => fetchLedger({ asOf: today }));
  const rows = list.data;

  useTableExport(
    rows
      ? {
          name: "sales-vs-ledger",
          title: `Customer Sales vs Ledger Balance as of ${formatDay(today)}`,
          headers: ["SL", "Customer Code", "Customer Name", "Customer Group", "Sales (Due)", "Ledger", "Diff."],
          rows: rows.map((row, index) => [index + 1, row.customerCode, row.customerName, row.customerGroup, row.salesDue.toFixed(2), row.ledger.toFixed(2), row.diff.toFixed(2)]),
        }
      : null,
    onExport,
  );

  const columns: Column<LedgerRow>[] = [
    sl(),
    { id: "code", header: "Customer Code", cell: (row) => row.customerCode, sortValue: (row) => row.customerCode },
    { id: "customer", header: "Customer Name", cell: (row) => row.customerName, sortValue: (row) => row.customerName },
    { id: "group", header: "Customer Group", cell: (row) => text(row.customerGroup), hideBelow: "md" },
    { id: "sales", header: "Sales (Due)", cell: (row) => amountCell(row.salesDue), sortValue: (row) => row.salesDue, className: "text-right" },
    { id: "ledger", header: "Ledger", cell: (row) => amountCell(row.ledger), sortValue: (row) => row.ledger, className: "text-right" },
    { id: "diff", header: "Diff.", cell: (row) => amountCell(row.diff), sortValue: (row) => Math.abs(row.diff), className: "text-right" },
  ];

  return (
    <>
      <p className="border-b border-line px-4 py-2.5 text-xs text-ink-muted">
        Sales (Due) adds up what is owed on each invoice. Ledger is everything delivered less returns and collections. The difference is money not yet applied to
        invoices (advances) and returns without an invoice.
      </p>
      <Results resource={list}>
        {(data) => (
          <DataTable
            rows={data}
            columns={columns}
            getRowId={(row) => row.customerId}
            getRowLabel={(row) => row.customerName}
            search={{ placeholder: "Search customer", match: (row, needle) => `${row.customerCode} ${row.customerName}`.toLowerCase().includes(needle) }}
            footer={(shown) => ({
              customer: "Total:",
              sales: amountCell(sum(shown, (row) => row.salesDue)),
              ledger: amountCell(sum(shown, (row) => row.ledger)),
              diff: amountCell(sum(shown, (row) => row.diff)),
            })}
            emptyState={<EmptyState title="No customer balances yet" />}
          />
        )}
      </Results>
    </>
  );
}
