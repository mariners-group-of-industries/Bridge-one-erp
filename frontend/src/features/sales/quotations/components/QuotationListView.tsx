"use client";

import { Download, Eye, Pencil, Plus, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { buttonClasses, Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { CONTROL, SelectField, TextField } from "@/components/ui/form-field";
import { Card, EmptyState, ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatAmount } from "../../dashboard/lib/format";
import { formatDay, useToday } from "../../lib/use-today";
import { fetchSalesLookups } from "../../masters/services/masters.api";
import { paths } from "../../paths";
import { STATUS_LABELS, displayStatus, quotationListQuerySchema, type QuotationListQuery, type QuotationListRow } from "../schemas/quotation.schema";
import { downloadQuotationsExcel, fetchQuotations } from "../services/quotation.api";
import { QuotationStatusIndicator } from "./QuotationStatusIndicator";

/** Managerium's status filter (Approved, Pending, Reject) plus the other stages. */
const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "SUBMITTED", label: STATUS_LABELS.SUBMITTED },
  { value: "DRAFT", label: STATUS_LABELS.DRAFT },
  { value: "LOST", label: STATUS_LABELS.LOST },
  { value: "ORDERED", label: STATUS_LABELS.ORDERED },
  { value: "EXPIRED", label: STATUS_LABELS.EXPIRED },
  { value: "CANCELLED", label: STATUS_LABELS.CANCELLED },
];

/** `value` once it has stopped changing for 400 ms. */
function useDebounced(value: string) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), 400);
    return () => clearTimeout(timer);
  }, [value]);
  return settled;
}

export function QuotationListView() {
  const today = useToday();
  const [search, setSearch] = useState("");
  const [exportQuery, setExportQuery] = useState<QuotationListQuery | null>(null);
  const [exporting, setExporting] = useState(false);
  const toast = useToast();

  async function exportExcel() {
    if (!exportQuery) return;
    setExporting(true);
    try {
      await downloadQuotationsExcel(exportQuery);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setExporting(false);
    }
  }

  return (
    <PageContainer className="max-w-none">
      <PageHead
        title="Sales Quotation"
        actions={
          <>
            <label className="relative w-56">
              <span className="sr-only">Search quotations</span>
              <Search aria-hidden="true" className="pointer-events-none absolute top-1.5 left-2 size-4 text-ink-faint" />
              <input type="search" value={search} placeholder="Search…" onChange={(event) => setSearch(event.target.value)} className={cn(CONTROL, "h-7 pl-7")} />
            </label>
            <Button onClick={exportExcel} loading={exporting} disabled={!exportQuery}>
              <Download aria-hidden="true" />
              Excel
            </Button>
            <Link href={paths.newQuotation} className={buttonClasses("primary")}>
              <Plus aria-hidden="true" />
              Create Quotation
            </Link>
          </>
        }
      />
      {today ? <QuotationList today={today} search={search} onQuery={setExportQuery} /> : <LoadingState />}
    </PageContainer>
  );
}

type Filters = { officeId: string; from: string; to: string; status: string };

function QuotationList({ today, search, onQuery }: { today: string; search: string; onQuery: (query: QuotationListQuery) => void }) {
  const lookups = useResource("lookups", fetchSalesLookups);
  const [filters, setFilters] = useState<Filters>({ officeId: "", from: "", to: "", status: "" });
  const [applied, setApplied] = useState<Omit<QuotationListQuery, "search">>({ today });
  const [filterError, setFilterError] = useState<string>();
  const searched = useDebounced(search.trim());
  const query: QuotationListQuery = { ...applied, ...(searched ? { search: searched } : {}) };
  const key = JSON.stringify(query);
  const list = useResource(`quotations:${key}`, () => fetchQuotations(query), { refreshOnFocus: true });

  useEffect(() => {
    onQuery(JSON.parse(key) as QuotationListQuery);
  }, [key, onQuery]);

  function view(event: FormEvent) {
    event.preventDefault();
    const parsed = quotationListQuerySchema.safeParse({
      today,
      officeId: filters.officeId || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      status: filters.status || undefined,
    });
    if (!parsed.success) {
      setFilterError(parsed.error.issues[0]?.message);
      return;
    }
    setFilterError(undefined);
    if (JSON.stringify(parsed.data) === JSON.stringify(applied)) list.reload();
    else setApplied(parsed.data);
  }

  const columns: Column<QuotationListRow>[] = [
    { id: "sl", header: "SL", cell: (_row, index) => index + 1, className: "w-10 tabular-nums" },
    {
      id: "actions",
      header: "Actions",
      className: "w-20",
      cell: (row) => (
        <span className="flex items-center gap-1">
          <Link href={paths.quotation(row.id)} aria-label={`View ${row.number}`} title="View" className={buttonClasses("ghost", "icon")}>
            <Eye aria-hidden="true" />
          </Link>
          {row.status === "DRAFT" && (
            <Link href={paths.editQuotation(row.id)} aria-label={`Edit ${row.number}`} title="Edit" className={buttonClasses("ghost", "icon")}>
              <Pencil aria-hidden="true" />
            </Link>
          )}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => <QuotationStatusIndicator status={displayStatus(row.status, row.validTill, today)} />,
      sortValue: (row) => displayStatus(row.status, row.validTill, today),
    },
    { id: "number", header: "Quotation Code", cell: (row) => <span className="font-medium whitespace-nowrap text-ink">{row.number}</span>, sortValue: (row) => row.number },
    { id: "office", header: "Office Name", cell: (row) => row.officeName, sortValue: (row) => row.officeName, hideBelow: "lg" },
    { id: "customer", header: "Customer Name", cell: (row) => row.customerName, sortValue: (row) => row.customerName },
    { id: "mobile", header: "Mobile No.", cell: (row) => row.contactMobile ?? "—", hideBelow: "md" },
    { id: "date", header: "Quotation Date", cell: (row) => <span className="whitespace-nowrap">{formatDay(row.quotationDate)}</span>, sortValue: (row) => row.quotationDate, hideBelow: "sm" },
    { id: "validTill", header: "Valid Till Date", cell: (row) => <span className="whitespace-nowrap">{formatDay(row.validTill)}</span>, sortValue: (row) => row.validTill, hideBelow: "md" },
    {
      id: "amount",
      header: "Amount",
      cell: (row) => <span className="text-ink tabular-nums">{formatAmount(row.grandTotal)}</span>,
      sortValue: (row) => row.grandTotal,
      className: "text-right",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <form onSubmit={view} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
          <SelectField
            label="Office"
            value={filters.officeId}
            options={[{ value: "", label: "All" }, ...(lookups.data?.offices ?? []).map((office) => ({ value: office.id, label: office.name }))]}
            disabled={!lookups.data}
            onChange={(event) => setFilters({ ...filters, officeId: event.target.value })}
          />
          <TextField label="From Date" type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
          <TextField label="To Date" type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
          <SelectField label="Status" value={filters.status} options={STATUS_OPTIONS} onChange={(event) => setFilters({ ...filters, status: event.target.value })} />
          <Button type="submit" variant="primary" disabled={list.loading}>
            <RefreshCw aria-hidden="true" />
            View
          </Button>
          {filterError && (
            <p role="alert" className="text-xs text-danger sm:col-span-2 lg:col-span-5">
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
            <DataTable
              rows={list.data}
              columns={columns}
              getRowId={(row) => row.id}
              getRowLabel={(row) => row.number}
              rowHref={(row) => paths.quotation(row.id)}
              footer={(rows) => ({ number: `${rows.length} quotations`, amount: formatAmount(rows.reduce((sum, row) => sum + row.grandTotal, 0)) })}
              emptyState={
                <EmptyState title="No quotations found">
                  <Link href={paths.newQuotation} className="font-medium text-ink underline underline-offset-2">
                    Create a quotation
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
