"use client";

import { Copy, Ellipsis, ExternalLink, Plus, RefreshCw, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { buttonClasses, Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/ui/dialog";
import { DropdownMenu, type MenuItem } from "@/components/ui/dropdown-menu";
import { SelectField, TextField } from "@/components/ui/form-field";
import { Card, EmptyState, ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { formatAmount } from "../../dashboard/lib/format";
import { formatDay, useToday } from "../../lib/use-today";
import { fetchSalesLookups } from "../../masters/services/masters.api";
import { paths } from "../../paths";
import {
  QUOTATION_STATUSES,
  STATUS_LABELS,
  displayStatus,
  quotationListQuerySchema,
  type QuotationListQuery,
  type QuotationListRow,
} from "../schemas/quotation.schema";
import { changeQuotationStatus, deleteQuotation, fetchQuotations } from "../services/quotation.api";
import { QuotationStatusIndicator } from "./QuotationStatusIndicator";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  ...[...QUOTATION_STATUSES, "EXPIRED" as const].map((status) => ({ value: status, label: STATUS_LABELS[status] })),
];

export function QuotationListView() {
  const today = useToday();
  return (
    <PageContainer>
      <PageHead
        title="Sales Quotation"
        actions={
          <Link href={paths.newQuotation} className={buttonClasses("primary")}>
            <Plus aria-hidden="true" />
            Create Quotation
          </Link>
        }
      />
      {today ? <QuotationList today={today} /> : <LoadingState />}
    </PageContainer>
  );
}

type Filters = { officeId: string; from: string; to: string; status: string };

function QuotationList({ today }: { today: string }) {
  const toast = useToast();
  const lookups = useResource("lookups", fetchSalesLookups);
  const [filters, setFilters] = useState<Filters>({ officeId: "", from: "", to: "", status: "" });
  const [query, setQuery] = useState<QuotationListQuery>({ today });
  const [filterError, setFilterError] = useState<string>();
  const list = useResource(JSON.stringify(query), () => fetchQuotations(query));
  const [toDelete, setToDelete] = useState<QuotationListRow[]>([]);
  const [busy, setBusy] = useState(false);

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
    if (JSON.stringify(parsed.data) === JSON.stringify(query)) list.reload();
    else setQuery(parsed.data);
  }

  async function submit(row: QuotationListRow) {
    try {
      await changeQuotationStatus(row.id, "submit", row.updatedAt);
      toast.success(`${row.number} submitted.`);
      list.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function confirmDelete() {
    setBusy(true);
    const results = await Promise.allSettled(toDelete.map((row) => deleteQuotation(row.id)));
    setBusy(false);
    const failed = results.filter((result) => result.status === "rejected");
    const deleted = results.length - failed.length;
    if (deleted > 0) toast.success(`${deleted} quotation${deleted === 1 ? "" : "s"} deleted.`);
    if (failed.length > 0) toast.error(errorMessage((failed[0] as PromiseRejectedResult).reason));
    setToDelete([]);
    list.reload();
  }

  const rowActions = (row: QuotationListRow): MenuItem[] => [
    { label: "Open", icon: <ExternalLink />, href: paths.quotation(row.id) },
    { label: "Duplicate", icon: <Copy />, href: `${paths.newQuotation}?copy=${row.id}` },
    ...(row.status === "DRAFT"
      ? ([
          { label: "Submit", icon: <Send />, onSelect: () => submit(row) },
          "separator",
          { label: "Delete", icon: <Trash2 />, danger: true, onSelect: () => setToDelete([row]) },
        ] satisfies MenuItem[])
      : []),
  ];

  const columns: Column<QuotationListRow>[] = [
    {
      id: "number",
      header: "Quotation Code",
      cell: (row) => <span className="font-medium text-ink">{row.number}</span>,
      sortValue: (row) => row.number,
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => <QuotationStatusIndicator status={displayStatus(row.status, row.validTill, today)} />,
      sortValue: (row) => displayStatus(row.status, row.validTill, today),
    },
    { id: "office", header: "Office Name", cell: (row) => row.officeName, sortValue: (row) => row.officeName, hideBelow: "lg" },
    { id: "customer", header: "Customer Name", cell: (row) => row.customerName, sortValue: (row) => row.customerName },
    { id: "mobile", header: "Mobile No.", cell: (row) => row.contactMobile ?? "—", hideBelow: "md" },
    {
      id: "date",
      header: "Quotation Date",
      cell: (row) => formatDay(row.quotationDate),
      sortValue: (row) => row.quotationDate,
      hideBelow: "sm",
    },
    {
      id: "validTill",
      header: "Valid Till Date",
      cell: (row) => formatDay(row.validTill),
      sortValue: (row) => row.validTill,
      hideBelow: "md",
    },
    {
      id: "amount",
      header: "Amount",
      cell: (row) => <span className="text-ink tabular-nums">{formatAmount(row.grandTotal)}</span>,
      sortValue: (row) => row.grandTotal,
      className: "text-right",
    },
    {
      id: "actions",
      header: "Actions",
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

  const officeOptions = [
    { value: "", label: "All" },
    ...(lookups.data?.offices ?? []).map((office) => ({ value: office.id, label: office.name })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <form onSubmit={view} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
          <SelectField
            label="Office"
            value={filters.officeId}
            options={officeOptions}
            disabled={!lookups.data}
            onChange={(event) => setFilters({ ...filters, officeId: event.target.value })}
          />
          <TextField
            label="From Date"
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(event) => setFilters({ ...filters, from: event.target.value })}
          />
          <TextField
            label="To Date"
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(event) => setFilters({ ...filters, to: event.target.value })}
          />
          <SelectField
            label="Status"
            value={filters.status}
            options={STATUS_OPTIONS}
            onChange={(event) => setFilters({ ...filters, status: event.target.value })}
          />
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
              search={{
                placeholder: "Search code, customer or mobile",
                match: (row, needle) =>
                  row.number.toLowerCase().includes(needle) ||
                  row.customerName.toLowerCase().includes(needle) ||
                  (row.contactMobile ?? "").includes(needle),
              }}
              bulkActions={(selected, clear) => {
                const drafts = selected.filter((row) => row.status === "DRAFT");
                return [
                  {
                    label: drafts.length === selected.length ? "Delete" : `Delete ${drafts.length} draft(s)`,
                    danger: true,
                    disabled: drafts.length === 0,
                    onSelect: () => {
                      setToDelete(drafts);
                      clear();
                    },
                  },
                ];
              }}
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

      <ConfirmDialog
        open={toDelete.length > 0}
        title={toDelete.length === 1 ? `Delete ${toDelete[0].number}?` : `Delete ${toDelete.length} quotations?`}
        message="Only draft quotations can be deleted. This cannot be undone."
        busy={busy}
        onConfirm={confirmDelete}
        onClose={() => setToDelete([])}
      />
    </div>
  );
}
