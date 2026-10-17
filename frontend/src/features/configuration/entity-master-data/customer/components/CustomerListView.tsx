"use client";

import { Eye, Pencil, Plus, Search, Upload, UserRound, Users, X } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { entityMasterDataBreadcrumbs } from "../../breadcrumbs";
import { BulkUploadDialog } from "../../components/BulkUploadDialog";
import { CONTROL_CLASS, EmptyBlock, Field, Input, Notice, Select, StatusBadge } from "../../employee/components/kit";
import { entityMasterDataPaths } from "../../paths";
import {
  MAX_CUSTOMER_IMPORT_ROWS,
  SALES_FORCE_LIMIT,
  type CustomerFilters,
  type CustomerList,
  type CustomerListRow,
} from "../schemas/customer.schema";
import { customerApi, customerQuery } from "../services/customer.api";
import { CustomerViewDialog } from "./CustomerViewDialog";

const PAGE_SIZES = [10, 25, 50, 100] as const;
const BREADCRUMBS = entityMasterDataBreadcrumbs(entityMasterDataPaths.customerProfile);
const NONE = <span className="text-ink-faint">—</span>;
const TABS = [
  { id: "details", label: "Customer Details" },
  { id: "sales-force", label: "Sales Force Wise Customer Details" },
] as const;
type TabId = (typeof TABS)[number]["id"];

type Filters = Omit<CustomerFilters, "search">;
const EMPTY_FILTERS: Filters = {};

const money = (value: string | null) =>
  value === null ? NONE : Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function CustomerListView() {
  const [tab, setTab] = useState<TabId>("details");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  // Filters are edited in `draft` and applied with "View".
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const options = useResource("customer-form-options", customerApi.formOptions);
  const toast = useToast();
  const [viewing, setViewing] = useState<CustomerListRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const rowActions: RowActions = {
    busyId,
    onView: setViewing,
    onToggleActive: async (row) => {
      setBusyId(row.id);
      try {
        await customerApi.setActive(row.id, !row.isActive);
        toast.success(`${row.name} is now ${row.isActive ? "inactive" : "active"}.`);
        setRefresh((value) => value + 1);
      } catch (err) {
        toast.error(errorMessage(err));
      } finally {
        setBusyId(null);
      }
    },
  };

  const query: CustomerFilters = { search: debouncedSearch, ...filters };
  const dateError = draft.fromDate && draft.toDate && draft.fromDate > draft.toDate ? "From date is after To date." : null;
  const pending = customerQuery(draft) !== customerQuery(filters);
  const anyFilter = debouncedSearch !== "" || Object.values(filters).some(Boolean) || Object.values(draft).some(Boolean);

  const unitOf = (officeId?: string) => options.data?.offices.find((office) => office.id === officeId)?.businessUnitId;
  const draftUnit = unitOf(draft.officeId);
  const inUnit = <T extends { businessUnitId: string }>(list: T[] | undefined) =>
    (list ?? []).filter((item) => !draftUnit || item.businessUnitId === draftUnit);
  const groups = inUnit(options.data?.groups).filter((group) => !group.parentId);
  const subGroups = (options.data?.groups ?? []).filter((group) => draft.groupId && group.parentId === draft.groupId);
  const territories = inUnit(options.data?.territories);

  const changeDraft = (changes: Filters) => {
    setDraft((current) => {
      const next = { ...current, ...changes };
      if ("officeId" in changes) {
        const unit = unitOf(next.officeId);
        const group = options.data?.groups.find((item) => item.id === next.groupId);
        if (unit && group && group.businessUnitId !== unit) next.groupId = next.subGroupId = undefined;
        const territory = options.data?.territories.find((item) => item.id === next.territoryId);
        if (unit && territory && territory.businessUnitId !== unit) next.territoryId = undefined;
      }
      if ("groupId" in changes) next.subGroupId = undefined;
      return next;
    });
  };
  const view = () => !dateError && setFilters(draft);
  const clearAll = () => {
    setSearch("");
    setDraft(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
  };

  return (
    <PageContainer full>
      <PageHead
        title="Customer Profile"
        subtitle="Customers you sell to: partner, billing and shipping details. Used across Sales."
        breadcrumbs={BREADCRUMBS}
        actions={
          <>
            <label className="relative w-full sm:w-64">
              <span className="sr-only">Search customers</span>
              <Search aria-hidden="true" className="pointer-events-none absolute top-2 left-2.5 size-4 text-ink-faint" />
              <input
                type="search"
                value={search}
                maxLength={100}
                placeholder="Search code, name, mobile…"
                title="Searches partner code, name, mobile, email, billing contact, NID and BIN"
                onChange={(event) => setSearch(event.target.value)}
                className={cn(CONTROL_CLASS, "pl-8")}
              />
            </label>
            <Button onClick={() => setUploadOpen(true)}>
              <Upload /> Bulk Upload
            </Button>
            <Link href={entityMasterDataPaths.customerCreate} className={buttonClasses("accent", "md")}>
              <Plus /> Customer
            </Link>
          </>
        }
      />

      <section className="rounded border border-line bg-surface shadow-xs">
        {/* ─── Filters ("View" applies them) ─── */}
        <form
          aria-label="Filters"
          className="grid grid-cols-1 items-end gap-3 border-b border-line px-4 py-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8"
          onSubmit={(event) => {
            event.preventDefault();
            view();
          }}
        >
          <FilterField label="Office">
            {(id) => (
              <Select
                id={id}
                value={draft.officeId ?? ""}
                placeholder="All offices"
                disabled={!options.data}
                options={(options.data?.offices ?? []).map((office) => ({ value: office.id, label: office.name }))}
                onChange={(e) => changeDraft({ officeId: e.target.value || undefined })}
              />
            )}
          </FilterField>
          <FilterField label="Group">
            {(id) => (
              <Select
                id={id}
                value={draft.groupId ?? ""}
                placeholder="All groups"
                disabled={!options.data}
                options={groups.map((group) => ({ value: group.id, label: group.name }))}
                onChange={(e) => changeDraft({ groupId: e.target.value || undefined })}
              />
            )}
          </FilterField>
          <FilterField label="Sub Group">
            {(id) => (
              <Select
                id={id}
                value={draft.subGroupId ?? ""}
                placeholder={draft.groupId ? "All sub groups" : "Select a group"}
                disabled={!draft.groupId}
                options={subGroups.map((group) => ({ value: group.id, label: group.name }))}
                onChange={(e) => changeDraft({ subGroupId: e.target.value || undefined })}
              />
            )}
          </FilterField>
          <FilterField label="Active/Inactive">
            {(id) => (
              <Select
                id={id}
                value={draft.status ?? ""}
                placeholder="All"
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
                onChange={(e) => changeDraft({ status: (e.target.value || undefined) as Filters["status"] })}
              />
            )}
          </FilterField>
          <FilterField label="Territory">
            {(id) => (
              <Select
                id={id}
                value={draft.territoryId ?? ""}
                placeholder="All territories"
                disabled={!options.data}
                options={territories.map((territory) => ({ value: territory.id, label: territory.name }))}
                onChange={(e) => changeDraft({ territoryId: e.target.value || undefined })}
              />
            )}
          </FilterField>
          <FilterField label="From Date">
            {(id) => (
              <Input
                id={id}
                type="date"
                value={draft.fromDate ?? ""}
                aria-invalid={!!dateError || undefined}
                onChange={(e) => changeDraft({ fromDate: e.target.value || undefined })}
              />
            )}
          </FilterField>
          <FilterField label="To Date">
            {(id) => (
              <Input
                id={id}
                type="date"
                value={draft.toDate ?? ""}
                aria-invalid={!!dateError || undefined}
                onChange={(e) => changeDraft({ toDate: e.target.value || undefined })}
              />
            )}
          </FilterField>
          <div className="flex items-center gap-2">
            <Button type="submit" variant="accent" disabled={!!dateError} title="Apply the filters">
              <Eye /> View
            </Button>
            {anyFilter && (
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex h-8 items-center gap-1 rounded px-2 text-xs font-semibold text-accent-strong hover:bg-accent-soft focus-visible:outline-2 dark:text-accent"
              >
                <X aria-hidden="true" className="size-3.5" /> Clear
              </button>
            )}
          </div>
          {(dateError || pending) && (
            <p className={cn("col-span-full text-xs", dateError ? "text-danger" : "text-ink-faint")}>
              {dateError ?? "Filters changed: press View to apply them."}
            </p>
          )}
        </form>

        <Tabs tabs={TABS} value={tab} onChange={setTab} label="Customer views">
          {tab === "details" ? (
            <CustomerDetailsTab query={query} refresh={refresh} onClear={clearAll} filtered={anyFilter} actions={rowActions} />
          ) : (
            <SalesForceTab query={query} refresh={refresh} actions={rowActions} />
          )}
        </Tabs>
      </section>

      <CustomerViewDialog customer={viewing} options={options.data} onClose={() => setViewing(null)} />

      <BulkUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onImported={() => setRefresh((value) => value + 1)}
        noun="customers"
        templateUrl={customerApi.templateUrl}
        maxRows={MAX_CUSTOMER_IMPORT_ROWS}
        matchHint="Office, groups, territory, price type, district, thana and tax bracket must match existing names."
        upload={customerApi.importFile}
      />
    </PageContainer>
  );
}

function FilterField({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  return <Field label={label}>{children}</Field>;
}

// ─── Customer Details tab ─────────────────────────────────────────────────────

function CustomerDetailsTab({
  query,
  refresh,
  filtered,
  onClear,
  actions,
}: {
  query: CustomerFilters;
  refresh: number;
  filtered: boolean;
  onClear: () => void;
  actions: RowActions;
}) {
  const [pageSize, setPageSize] = useState<number>(10);
  const queryKey = customerQuery(query);
  // The requested page belongs to the query it was chosen for; a new query starts on page 1.
  const [paging, setPaging] = useState({ page: 1, key: queryKey });
  const page = paging.key === queryKey ? paging.page : 1;
  const list = useResource(`customers?${queryKey}&page=${page}&size=${pageSize}&r=${refresh}`, () =>
    customerApi.list({ ...query, page, pageSize }),
  );
  const [shown, setShown] = useState<CustomerList>();
  if (list.data && list.data !== shown) setShown(list.data);
  const goToPage = (next: number) => setPaging({ page: next, key: queryKey });

  if (list.error) return <ErrorState message={list.error.message} onRetry={list.reload} />;
  if (!shown) return <LoadingState label="Loading customers…" />;
  if (shown.total === 0) return <NoCustomers filtered={filtered} onClear={onClear} />;

  const first = (shown.page - 1) * shown.pageSize + 1;
  return (
    <>
      <div className={cn("overflow-x-auto transition-opacity", list.loading && "opacity-60")} aria-busy={list.loading || undefined}>
        <CustomerTable
          rows={shown.rows}
          serial={(index) => first + index}
          columns={LIST_COLUMNS}
          actions={actions}
        />
      </div>
      <div className="border-t border-line bg-canvas px-5 py-2.5">
        <Pagination
          page={shown.page}
          pageSize={pageSize}
          totalRecords={shown.total}
          totalPages={Math.max(1, Math.ceil(shown.total / shown.pageSize))}
          pageSizes={PAGE_SIZES}
          onPageChange={goToPage}
          onPageSizeChange={(next) => {
            setPageSize(next);
            goToPage(1);
          }}
          disabled={list.loading}
          noun="customers"
        />
      </div>
    </>
  );
}

// ─── Sales force wise tab ─────────────────────────────────────────────────────

function SalesForceTab({ query, refresh, actions }: { query: CustomerFilters; refresh: number; actions: RowActions }) {
  const list = useResource(`customers-sales-force?${customerQuery(query)}&r=${refresh}`, () => customerApi.salesForce(query));

  if (list.error) return <ErrorState message={list.error.message} onRetry={list.reload} />;
  if (!list.data) return <LoadingState label="Loading sales force…" />;
  if (list.data.total === 0) {
    return (
      <div className="p-5">
        <EmptyBlock icon={<Users />} title="No customers to show">
          Change the search or filters.
        </EmptyBlock>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4 p-4 transition-opacity", list.loading && "opacity-60")}>
      {list.data.truncated && (
        <Notice tone="error">
          Showing the first {SALES_FORCE_LIMIT} of {list.data.total} customers. Narrow the filters to see the rest.
        </Notice>
      )}
      {list.data.groups.map((group) => (
        <section key={group.salesPerson?.id ?? "unassigned"} className="overflow-hidden rounded border border-line">
          <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-canvas px-3 py-2">
            <UserRound aria-hidden="true" className="size-4 text-accent-strong dark:text-accent" />
            <h3 className="text-xs font-bold tracking-wide text-ink uppercase">
              {group.salesPerson ? group.salesPerson.name : "Unassigned"}
            </h3>
            {group.salesPerson && (
              <span className="text-xs text-ink-faint">
                {group.salesPerson.code}
                {group.salesPerson.phone && ` · ${group.salesPerson.phone}`}
              </span>
            )}
            <span className="ml-auto rounded border border-accent-line bg-accent-soft px-1.5 text-[10px] font-semibold text-accent-strong tabular-nums dark:text-accent">
              {group.customers.length} customer{group.customers.length === 1 ? "" : "s"}
            </span>
          </header>
          <div className="overflow-x-auto">
            <CustomerTable
              rows={group.customers}
              serial={(index) => index + 1}
              columns={LIST_COLUMNS}
              actions={actions}
            />
          </div>
        </section>
      ))}
    </div>
  );
}

// ─── Shared table ─────────────────────────────────────────────────────────────

type ColumnId =
  | "code"
  | "name"
  | "createdAt"
  | "billingName"
  | "group"
  | "subGroup"
  | "billingPhone"
  | "mobile"
  | "office"
  | "billingAddress"
  | "creditLimit"
  | "territory"
  | "type"
  | "status";

/** Customer Details columns, in the required order (SL and Action come first). */
const LIST_COLUMNS: ColumnId[] = [
  "code",
  "name",
  "createdAt",
  "billingName",
  "group",
  "subGroup",
  "billingPhone",
  "mobile",
  "office",
  "billingAddress",
  "creditLimit",
  "territory",
  "type",
  "status",
];

const createdDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-");

const COLUMN_DEFS: Record<ColumnId, { header: string; className?: string; cell: (row: CustomerListRow) => ReactNode }> = {
  code: { header: "Partner Code", className: "font-medium text-ink whitespace-nowrap", cell: (row) => row.code },
  name: {
    header: "Partner Name",
    className: "whitespace-nowrap",
    cell: (row) => (
      <Link href={entityMasterDataPaths.customerEdit(row.id)} className="font-medium text-accent-strong hover:underline dark:text-accent">
        {row.name}
      </Link>
    ),
  },
  createdAt: { header: "Create Date", className: "whitespace-nowrap tabular-nums", cell: (row) => createdDate(row.createdAt) },
  billingName: { header: "Partner Billing Name", className: "whitespace-nowrap", cell: (row) => row.billingName ?? NONE },
  group: { header: "Partner Group", className: "whitespace-nowrap", cell: (row) => row.groupName ?? NONE },
  subGroup: { header: "Partner Sub Group", className: "whitespace-nowrap", cell: (row) => row.subGroupName ?? NONE },
  billingPhone: { header: "Billing Phone No", className: "whitespace-nowrap tabular-nums", cell: (row) => row.billingContactNo ?? NONE },
  mobile: { header: "Other Phone No", className: "whitespace-nowrap tabular-nums", cell: (row) => row.mobile ?? NONE },
  office: { header: "Created Office", className: "whitespace-nowrap", cell: (row) => row.officeName ?? NONE },
  billingAddress: {
    header: "Billing Address",
    className: "max-w-72 truncate",
    cell: (row) => (row.billingAddress ? <span title={row.billingAddress}>{row.billingAddress}</span> : NONE),
  },
  creditLimit: { header: "Credit Limit", className: "text-right tabular-nums", cell: (row) => money(row.creditLimit) },
  territory: { header: "Territory", className: "whitespace-nowrap", cell: (row) => row.territoryName ?? NONE },
  type: {
    header: "Type",
    cell: (row) => (
      <span
        className={cn(
          "inline-flex h-5 items-center rounded border px-2 text-[10px] font-semibold tracking-wide uppercase",
          row.isForeign ? "border-warning/30 bg-warning/10 text-warning" : "border-accent-line bg-accent-soft text-accent-strong dark:text-accent",
        )}
      >
        {row.isForeign ? "Foreign" : "Local"}
      </span>
    ),
  },
  status: { header: "Status", cell: (row) => <StatusBadge active={row.isActive} /> },
};

/** Row buttons: Active/Inactive toggle, View and Edit. */
interface RowActions {
  onView: (row: CustomerListRow) => void;
  onToggleActive: (row: CustomerListRow) => void;
  /** Customer whose status is being saved. */
  busyId: string | null;
}

function CustomerTable({
  rows,
  serial,
  columns,
  actions,
}: {
  rows: CustomerListRow[];
  serial: (index: number) => number;
  columns: ColumnId[];
  actions: RowActions;
}) {
  return (
    <table className="data-grid w-full min-w-max">
      <thead>
        <tr>
          <th scope="col" className="w-12 px-2.5 py-2 text-left">SL</th>
          <th scope="col" className="px-2.5 py-2 text-center">Action</th>
          {columns.map((id) => (
            <th key={id} scope="col" className="px-2.5 py-2 text-left">
              {COLUMN_DEFS[id].header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.id}>
            <td className="px-2.5 py-2 text-right text-ink-faint tabular-nums">{serial(index)}</td>
            <td className="px-1.5 py-1">
              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  role="switch"
                  aria-checked={row.isActive}
                  aria-label={`${row.name} is ${row.isActive ? "active" : "inactive"}; click to ${row.isActive ? "deactivate" : "activate"}`}
                  title={row.isActive ? "Active: click to deactivate" : "Inactive: click to activate"}
                  disabled={actions.busyId === row.id}
                  onClick={() => actions.onToggleActive(row)}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-2 disabled:opacity-50",
                    row.isActive ? "border-success bg-success" : "border-line-strong bg-control",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "inline-block size-3.5 rounded-full bg-white shadow-xs transition-transform",
                      row.isActive ? "translate-x-[18px]" : "translate-x-0.5",
                    )}
                  />
                </button>
                <button
                  type="button"
                  title="View customer"
                  aria-label={`View ${row.name}`}
                  onClick={() => actions.onView(row)}
                  className={cn(buttonClasses("ghost", "icon"), "hover:bg-accent-soft hover:text-accent-strong")}
                >
                  <Eye aria-hidden="true" />
                </button>
                <Link
                  href={entityMasterDataPaths.customerEdit(row.id)}
                  title="Edit customer"
                  aria-label={`Edit ${row.name}`}
                  className={cn(buttonClasses("ghost", "icon"), "hover:bg-accent-soft hover:text-accent-strong")}
                >
                  <Pencil aria-hidden="true" />
                </Link>
              </div>
            </td>
            {columns.map((id) => (
              <td key={id} className={cn("px-2.5 py-2", COLUMN_DEFS[id].className)}>
                {COLUMN_DEFS[id].cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function NoCustomers({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return (
    <div className="p-5">
      {filtered ? (
        <EmptyBlock icon={<Search />} title="No matching customers">
          <p>Try a different search or filter.</p>
          <Button size="sm" className="mt-3" onClick={onClear}>
            Clear search &amp; filters
          </Button>
        </EmptyBlock>
      ) : (
        <EmptyBlock icon={<Users />} title="No customers yet">
          <p>Add a customer, or upload many at once from Excel.</p>
          <Link href={entityMasterDataPaths.customerCreate} className={buttonClasses("accent", "sm", "mt-3")}>
            <Plus /> Customer
          </Link>
        </EmptyBlock>
      )}
    </div>
  );
}
