"use client";

import { Ban, CirclePlus, Eye, Plus, Printer, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import type { Column } from "@/components/ui/data-table";
import { ListTable } from "@/features/production/components/ListTable";
import { Dialog } from "@/components/ui/dialog";
import { CONTROL, SelectField, TextAreaField, TextField } from "@/components/ui/form-field";
import { Indicator } from "@/components/ui/indicator";
import { Card, EmptyState, ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { LineTable } from "@/features/production/bom/components/BomDialogs";
import { OrderStatusBadge, day, money, qty2, stamp } from "@/features/production/orders/components/OrderParts";
import { fetchWorkCenterLookups } from "@/features/production/work-centers/services/work-center.api";
import { addDays, useToday } from "@/features/sales/lib/use-today";
import { paths } from "../../paths";
import { entryListQuerySchema, type EntryDetail, type EntryListQuery, type EntryRow, type QueueRow } from "../schemas/entry.schema";
import { cancelEntry, entryPdfUrl, fetchEntries, fetchEntry, fetchEntryQueue } from "../services/entry.api";
import { EntryWastageDialog } from "./EntryWastageDialog";

type Tab = "queue" | "list";
const TABS = [
  { id: "queue", label: "Approve Production Order" },
  { id: "list", label: "Production Entry List" },
] as const;

/** `value` once it has stopped changing for 400 ms. */
function useDebounced(value: string) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), 400);
    return () => clearTimeout(timer);
  }, [value]);
  return settled;
}

/** /production/entries?tab=queue|list — read the tab inside <Suspense> (search params are request-time). */
export function EntryWorkspaceView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab: Tab = params.get("tab") === "list" ? "list" : "queue";
  const [search, setSearch] = useState("");
  const settled = useDebounced(search.trim());
  const today = useToday();

  return (
    <PageContainer className="max-w-none">
      <PageHead
        title="Production Entry"
        actions={
          <label className="relative w-64">
            <span className="sr-only">Search</span>
            <Search aria-hidden="true" className="pointer-events-none absolute top-1.5 left-2 size-4 text-ink-faint" />
            <input
              type="search"
              value={search}
              placeholder={tab === "queue" ? "Search order, item, BOM…" : "Search entry, order, item…"}
              onChange={(event) => setSearch(event.target.value)}
              className={cn(CONTROL, "h-7 pl-7")}
            />
          </label>
        }
      />
      <Card>
        <Tabs<Tab> label="Production entry" tabs={TABS} value={tab} onChange={(next) => router.replace(`${pathname}?tab=${next}`)}>
          {tab === "queue" ? <QueueTab key="queue" search={settled} /> : today ? <ListTab key="list" search={settled} today={today} /> : <LoadingState />}
        </Tabs>
      </Card>
    </PageContainer>
  );
}

// ─── Tab 1: orders waiting for production ────────────────────────────────────

function QueueTab({ search }: { search: string }) {
  const queue = useResource(`production-entry-queue:${search}`, () => fetchEntryQueue(search || undefined));
  const columns: Column<QueueRow>[] = [
    { id: "sl", header: "SL", cell: (_row, index) => index + 1, className: `w-10 tabular-nums` },
    {
      id: "number",
      header: "Order Number",
      cell: (row) => (
        <Link href={paths.order(row.id)} className="font-medium whitespace-nowrap text-ink hover:underline">
          {row.number}
        </Link>
      ),
      sortValue: (row) => row.number,
    },
    { id: "date", header: "Order Date", cell: (row) => <span className="whitespace-nowrap">{day(row.orderDate)}</span>, sortValue: (row) => row.orderDate },
    {
      id: "item",
      header: "Item",
      cell: (row) => (
        <span className="text-ink">
          {`${row.itemCode} - ${row.itemName} (${row.bomName})`}
        </span>
      ),
      sortValue: (row) => row.itemName,
    },
    { id: "orderQty", header: "Order QTY", cell: (row) => `${qty2(row.orderQty)} ${row.uom}`, sortValue: (row) => row.orderQty, className: "text-right tabular-nums whitespace-nowrap" },
    { id: "produced", header: "Produced QTY", cell: (row) => qty2(row.producedQty), sortValue: (row) => row.producedQty, className: "text-right tabular-nums" },
    { id: "remaining", header: "Remaining QTY", cell: (row) => <span className="font-medium text-ink">{qty2(row.remainingQty)}</span>, sortValue: (row) => row.remainingQty, className: "text-right tabular-nums" },
    { id: "status", header: "Status", cell: (row) => <OrderStatusBadge status={row.status} /> },
    {
      id: "entry",
      header: "Production Entry",
      cell: (row) => (
        <Link href={paths.newEntry(row.id)} className={buttonClasses("primary", "sm")}>
          <Plus aria-hidden="true" />
          Create Entry
        </Link>
      ),
    },
  ];
  if (queue.error) return <ErrorState message={errorMessage(queue.error)} onRetry={queue.reload} />;
  if (!queue.data) return <LoadingState label="Loading approved orders…" />;
  return (
    <div className={queue.loading ? "opacity-60 transition-opacity" : undefined}>
      <ListTable
        rows={queue.data}
        columns={columns}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.number}
        emptyState={
          <EmptyState title={search ? "No open order matches" : "No approved order is waiting for production"}>
            Approve a production order first; it appears here until it is fully produced.
          </EmptyState>
        }
      />
    </div>
  );
}

// ─── Tab 2: entry log ────────────────────────────────────────────────────────

function ListTab({ search, today }: { search: string; today: string }) {
  const toast = useToast();
  const lookups = useResource("work-center-lookups", fetchWorkCenterLookups);
  const [filters, setFilters] = useState({ from: addDays(today, -29), to: today, departmentId: "", departmentSectionId: "", status: "" });
  const [applied, setApplied] = useState(filters);
  const [filterError, setFilterError] = useState<string>();
  const query = Object.fromEntries(Object.entries({ ...applied, search }).filter(([, value]) => value)) as EntryListQuery;
  const list = useResource(`production-entries:${JSON.stringify(query)}`, () => fetchEntries(query));
  const [viewing, setViewing] = useState<string | null>(null);
  const [wastageFor, setWastageFor] = useState<string | null>(null);

  function view(event: FormEvent) {
    event.preventDefault();
    const parsed = entryListQuerySchema.safeParse(filters);
    if (!parsed.success) return setFilterError(parsed.error.issues[0]?.message);
    setFilterError(undefined);
    if (JSON.stringify(filters) === JSON.stringify(applied)) list.reload();
    else setApplied(filters);
  }

  const sections = (lookups.data?.sections ?? []).filter((section) => !filters.departmentId || section.departmentId === filters.departmentId);
  const right = "text-right tabular-nums";
  const columns: Column<EntryRow>[] = [
    { id: "sl", header: "SL", cell: (_row, index) => index + 1, className: `w-10 tabular-nums` },
    {
      id: "action",
      header: "Action",
      className: `w-28`,
      cell: (row) => (
        <span className="flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label={`View ${row.number}`} title="View" onClick={() => setViewing(row.id)}>
            <Eye aria-hidden="true" />
          </Button>
          <Button size="icon" variant="ghost" aria-label={`Process wise wastage of ${row.number}`} title="Process Wise Wastage Entry" onClick={() => setWastageFor(row.id)}>
            <CirclePlus aria-hidden="true" />
          </Button>
          <a href={entryPdfUrl(row.id)} target="_blank" rel="noopener" aria-label={`Print ${row.number}`} title="Print slip" className={buttonClasses("ghost", "icon")}>
            <Printer aria-hidden="true" />
          </a>
        </span>
      ),
    },
    { id: "date", header: "Production Entry Date", cell: (row) => day(row.entryDate), sortValue: (row) => row.entryDate },
    {
      id: "number",
      header: "Production Entry Code",
      cell: (row) => (
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <span className={cn("font-medium text-ink", row.status === "CANCELLED" && "line-through")}>{row.number}</span>
          {row.status === "CANCELLED" && <span className="text-xs text-danger">(Cancelled)</span>}
        </span>
      ),
      sortValue: (row) => row.number,
    },
    {
      id: "order",
      header: "Prod. Order/Sche No",
      cell: (row) => (
        <Link href={paths.order(row.orderId)} className="whitespace-nowrap hover:underline">
          {row.orderNumber}
        </Link>
      ),
      sortValue: (row) => row.orderNumber,
    },
    { id: "salesOrder", header: "Sales Order", cell: (row) => row.salesOrderNumber ?? "N/A", hideBelow: "lg" },
    { id: "department", header: "Department", cell: (row) => row.departmentName ?? "N/A", sortValue: (row) => row.departmentName ?? "", hideBelow: "md" },
    { id: "section", header: "Section", cell: (row) => row.sectionName ?? "N/A", sortValue: (row) => row.sectionName ?? "", hideBelow: "md" },
    { id: "workCenter", header: "Work Center", cell: (row) => row.workCenterName ?? "N/A", hideBelow: "lg" },
    { id: "shift", header: "Shift", cell: (row) => row.shift ?? "N/A", hideBelow: "lg" },
    { id: "item", header: "Item Name", cell: (row) => `${row.itemCode} - ${row.itemName} (${row.uom})`, sortValue: (row) => row.itemName },
    { id: "category", header: "Category", cell: (row) => row.categoryName ?? "N/A", hideBelow: "lg" },
    { id: "subCategory", header: "Sub Category", cell: (row) => row.subCategoryName ?? "N/A", hideBelow: "lg" },
    { id: "total", header: "Total QTY", cell: (row) => qty2(row.totalQty), sortValue: (row) => row.totalQty, className: right },
    { id: "excess", header: "Excess QTY", cell: (row) => qty2(row.excessQty), sortValue: (row) => row.excessQty, className: right },
    { id: "net", header: "Net Qty", cell: (row) => qty2(row.netQty), sortValue: (row) => row.netQty, className: right },
    {
      id: "variance",
      header: "Varience",
      cell: (row) => <span className={row.variance > 0 ? "text-danger" : row.variance < 0 ? "text-success" : undefined}>{money(row.variance)}</span>,
      sortValue: (row) => row.variance,
      className: right,
    },
    { id: "weight", header: "Net Weight", cell: (row) => qty2(row.netWeight), sortValue: (row) => row.netWeight, className: right, hideBelow: "md" },
    { id: "createdBy", header: "Created By", cell: (row) => row.createdByName, sortValue: (row) => row.createdByName, hideBelow: "md" },
  ];

  return (
    <>
      <form onSubmit={view} className="grid items-end gap-3 border-b border-line p-4 sm:grid-cols-3 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
        <TextField label="From Date" type="date" value={filters.from} max={filters.to} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
        <TextField label="To Date" type="date" value={filters.to} min={filters.from} error={filterError} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
        <SelectField
          label="Department"
          value={filters.departmentId}
          options={[{ value: "", label: "All" }, ...(lookups.data?.departments ?? []).map((department) => ({ value: department.id, label: department.name }))]}
          onChange={(event) => setFilters({ ...filters, departmentId: event.target.value, departmentSectionId: "" })}
        />
        <SelectField
          label="Section"
          value={filters.departmentSectionId}
          options={[{ value: "", label: "All" }, ...sections.map((section) => ({ value: section.id, label: section.name }))]}
          onChange={(event) => setFilters({ ...filters, departmentSectionId: event.target.value })}
        />
        <SelectField
          label="Status"
          value={filters.status}
          options={[
            { value: "", label: "All" },
            { value: "POSTED", label: "Posted" },
            { value: "CANCELLED", label: "Cancelled" },
          ]}
          onChange={(event) => setFilters({ ...filters, status: event.target.value })}
        />
        <Button type="submit" variant="primary" disabled={list.loading}>
          <RefreshCw aria-hidden="true" />
          View
        </Button>
      </form>
      {list.error ? (
        <ErrorState message={errorMessage(list.error)} onRetry={list.reload} />
      ) : !list.data ? (
        <LoadingState label="Loading production entries…" />
      ) : (
        <div className={list.loading ? "opacity-60 transition-opacity" : undefined} aria-busy={list.loading}>
          <ListTable
            rows={list.data}
            columns={columns}
            getRowId={(row) => row.id}
            getRowLabel={(row) => row.number}
            footer={(shown) => {
              const posted = shown.filter((row) => row.status === "POSTED");
              const sum = (pick: (row: EntryRow) => number) => posted.reduce((total, row) => total + pick(row), 0);
              return {
                number: `${posted.length} posted`,
                total: qty2(sum((row) => row.totalQty)),
                excess: qty2(sum((row) => row.excessQty)),
                net: qty2(sum((row) => row.netQty)),
                variance: money(sum((row) => row.variance)),
                weight: qty2(sum((row) => row.netWeight)),
              };
            }}
            emptyState={<EmptyState title="No production entry in this range" />}
          />
        </div>
      )}
      <EntryDetailsDialog
        id={viewing}
        onClose={() => setViewing(null)}
        onCancelled={() => {
          toast.success("Production entry cancelled; stock and the order were restored.");
          list.reload();
        }}
      />
      <EntryWastageDialog id={wastageFor} onClose={() => setWastageFor(null)} onSaved={list.reload} />
    </>
  );
}

function Pair({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_auto_1fr] gap-x-2 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <span aria-hidden="true" className="text-ink-faint">
        :
      </span>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}

function EntryDetailsDialog({ id, onClose, onCancelled }: { id: string | null; onClose: () => void; onCancelled: () => void }) {
  const detail = useResource(id ? `production-entry:${id}` : null, () => fetchEntry(id!));
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const entry = detail.data;

  function close() {
    setCancelling(false);
    setReason("");
    setError(undefined);
    onClose();
  }

  async function cancel() {
    if (!entry) return;
    if (!reason.trim()) return setError("Give a reason.");
    setBusy(true);
    try {
      const updated = await cancelEntry(entry.id, entry.updatedAt, reason.trim());
      detail.mutate(() => updated);
      setCancelling(false);
      setReason("");
      onCancelled();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={id !== null}
      title="Production Entry Details"
      size="xl"
      className="max-w-7xl"
      onClose={busy ? () => undefined : close}
      footer={
        <>
          <Button variant="ghost" className="text-danger" onClick={close} disabled={busy}>
            CLOSE
          </Button>
          {entry?.canCancel && !cancelling && (
            <Button variant="danger" onClick={() => setCancelling(true)}>
              <Ban aria-hidden="true" />
              Cancel Entry
            </Button>
          )}
        </>
      }
    >
      {detail.error ? (
        <ErrorState message={errorMessage(detail.error)} onRetry={detail.reload} />
      ) : !entry ? (
        <LoadingState />
      ) : (
        <EntryDetailsBody entry={entry} />
      )}
      {entry && cancelling && (
        <div className="mt-4 flex flex-col gap-2 rounded-md border border-danger/30 p-3">
          <TextAreaField
            label="Reason for cancelling"
            required
            maxLength={500}
            value={reason}
            error={error}
            hint="Materials go back to stock, the output leaves stock and the order's produced quantity goes down."
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button onClick={() => setCancelling(false)} disabled={busy}>
              Back
            </Button>
            <Button variant="danger" onClick={cancel} loading={busy}>
              Confirm Cancel
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 id={id} className="text-base font-semibold text-ink">
      {children}
    </h3>
  );
}

/** Body of "Production Entry Details", laid out as in Managerium. */
function EntryDetailsBody({ entry }: { entry: EntryDetail }) {
  const na = (value: string | null | undefined) => value || "N/A";
  // Weight of one good unit (BOM net weight), for the defect (rejected) weight.
  const unitWeight = entry.netQty > 0 ? entry.netWeight / entry.netQty : 0;
  const variancePercent = entry.standardCost > 0 ? (entry.variance / entry.standardCost) * 100 : 0;
  const sum = (pick: (line: EntryDetail["materials"][number]) => number) => entry.materials.reduce((total, line) => total + pick(line), 0);
  const outputRow = [
    qty2(entry.totalQty),
    qty2(entry.excessQty),
    qty2(entry.netQty),
    `${qty2(variancePercent)}%`,
    qty2(entry.netWeight),
    qty2(entry.rejectQty),
    qty2(entry.rejectQty * unitWeight),
  ];
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Indicator color={entry.status === "POSTED" ? "green" : "gray"}>{entry.status === "POSTED" ? "Posted" : "Cancelled"}</Indicator>
        <a href={entryPdfUrl(entry.id)} target="_blank" rel="noopener" className={cn(buttonClasses("secondary", "sm"), "ml-auto text-accent-strong")}>
          <Printer aria-hidden="true" />
          PRINT/PDF
        </a>
      </div>

      <dl className="grid gap-x-10 gap-y-1.5 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Pair label="Prod Order/Sche NO" value={entry.orderNumber} />
          <Pair label="Order/Sche Date" value={day(entry.orderDate)} />
          <Pair label="Prod Entry NO" value={entry.number} />
          <Pair label="Entry Date" value={day(entry.entryDate)} />
          <Pair label="Bom Name" value={entry.bomName} />
          <Pair label="Operator Name" value={entry.operatorNames.join(", ") || "N/A"} />
          <Pair label="Sales Order" value={na(entry.salesOrderNumber)} />
          <Pair label="Material From" value={entry.sourceWarehouseName} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Pair label="Department" value={na(entry.departmentName)} />
          <Pair label="Section" value={na(entry.sectionName)} />
          <Pair label="Work Center" value={na(entry.workCenterName)} />
          <Pair label="Equipment" value={na(entry.equipment)} />
          <Pair label="Shift" value={na(entry.shift)} />
          <Pair label="Created By" value={`${entry.createdByName} · ${stamp(entry.createdAt)}`} />
          <Pair label="Output To" value={entry.outputWarehouseName} />
          <Pair label="Machine Hours" value={qty2(entry.hours)} />
        </div>
        {entry.remarks && (
          <div className="md:col-span-2">
            <Pair label="Remarks" value={entry.remarks} />
          </div>
        )}
      </dl>

      <section aria-labelledby="entry-output" className="flex flex-col gap-2">
        <SectionHeading id="entry-output">Output/Produce Item</SectionHeading>
        <LineTable
          columns={[
            { header: "SL", className: "w-12" },
            { header: "Code" },
            { header: "Item Name" },
            { header: "Category" },
            { header: "Sub Category" },
            { header: "UOM" },
            { header: "Total Qty", align: "right" },
            { header: "Excess Qty", align: "right" },
            { header: "Net Qty", align: "right" },
            { header: "Variance", align: "right" },
            { header: "Total Weight", align: "right" },
            { header: "Defect Qty", align: "right" },
            { header: "Defect Weight", align: "right" },
            { header: "Unit Cost", align: "right" },
            { header: "Total Cost", align: "right" },
          ]}
          rows={[
            [
              1,
              <span key="code" className="whitespace-nowrap">{entry.itemCode}</span>,
              <span key="name" className="inline-block min-w-48 text-ink">{`${entry.itemCode} - ${entry.itemName} (${entry.uom})`}</span>,
              na(entry.categoryName),
              na(entry.subCategoryName),
              entry.uom,
              ...outputRow,
              money(entry.unitCost),
              money(entry.actualCost),
            ],
          ]}
          footerLabelSpan={6}
          footer={[["Total", ...outputRow, "", money(entry.actualCost)]]}
        />
      </section>

      <section aria-labelledby="entry-materials" className="flex flex-col gap-2">
        <SectionHeading id="entry-materials">Materials Information</SectionHeading>
        <LineTable
          columns={[
            { header: "SL", className: "w-12" },
            { header: "Code" },
            { header: "Item Name" },
            { header: "Category" },
            { header: "Sub Category" },
            { header: "UOM" },
            { header: "Standard Qty", align: "right" },
            { header: "Actual Qty", align: "right" },
            { header: "Wastage", align: "right" },
            { header: "Scrap", align: "right" },
            { header: "Variance Qty", align: "right" },
            { header: "Unit Cost", align: "right" },
            { header: "Actual Total Cost", align: "right" },
          ]}
          rows={entry.materials.map((line, index) => [
            index + 1,
            <span key="code" className="whitespace-nowrap">{line.code}</span>,
            <span key="name" className="text-ink">{line.name}</span>,
            na(line.categoryName),
            na(line.subCategoryName),
            line.uom,
            qty2(line.standardQty),
            qty2(line.actualQty),
            qty2(line.wastageQty),
            qty2(line.scrapQty),
            <span key="v" className={line.varianceQty > 0 ? "text-danger" : line.varianceQty < 0 ? "text-success" : undefined}>
              {qty2(line.varianceQty)}
            </span>,
            money(line.rate),
            money(line.actualQty * line.rate),
          ])}
          footerLabelSpan={6}
          footer={[
            [
              "Total",
              qty2(sum((line) => line.standardQty)),
              qty2(sum((line) => line.actualQty)),
              qty2(sum((line) => line.wastageQty)),
              qty2(sum((line) => line.scrapQty)),
              qty2(sum((line) => line.varianceQty)),
              "",
              money(sum((line) => line.actualQty * line.rate)),
            ],
          ]}
          empty="No material was consumed."
        />
      </section>

      {entry.wastages.length > 0 && (
        <section aria-labelledby="entry-wastage" className="flex flex-col gap-2">
          <SectionHeading id="entry-wastage">Process Wise Wastage</SectionHeading>
          <LineTable
            columns={[{ header: "SL", className: "w-12" }, { header: "Process Name" }, { header: "Code" }, { header: "Item Name" }, { header: "UOM" }, { header: "Wastage Quantity", align: "right" }]}
            rows={entry.wastages.map((line, index) => [
              index + 1,
              <span key="process" className="text-ink">{line.processName}</span>,
              <span key="code" className="whitespace-nowrap">{line.code}</span>,
              line.name,
              line.uom,
              qty2(line.qty),
            ])}
          />
        </section>
      )}

      <section aria-labelledby="entry-approval" className="flex flex-col gap-2">
        <SectionHeading id="entry-approval">Approval Status</SectionHeading>
        {entry.status === "CANCELLED" ? (
          <p className="rounded-md bg-control px-3 py-2 text-sm text-ink-muted">
            Cancelled by <span className="font-medium text-ink">{entry.cancelledByName ?? "N/A"}</span>
            {entry.cancelledAt ? ` on ${stamp(entry.cancelledAt)}` : ""}
            {entry.cancelReason ? `: ${entry.cancelReason}` : ""}
          </p>
        ) : (
          <p className="text-sm text-ink-muted">
            Posted by <span className="font-medium text-ink">{entry.createdByName}</span> on {stamp(entry.createdAt)}. The production order was approved before this entry; the entry itself needs no
            further approval.
          </p>
        )}
      </section>
    </div>
  );
}
