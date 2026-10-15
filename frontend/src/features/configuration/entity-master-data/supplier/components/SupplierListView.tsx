"use client";

import { FileSpreadsheet, Pencil, Plus, Search, Truck, Upload, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useResource } from "@/hooks/use-resource";
import { cn } from "@/lib/cn";
import { entityMasterDataBreadcrumbs } from "../../breadcrumbs";
import { CONTROL_CLASS, EmptyBlock, Select, StatusBadge } from "../../employee/components/kit";
import { entityMasterDataPaths } from "../../paths";
import { MAX_IMPORT_ROWS, type SupplierFilters, type SupplierList } from "../schemas/supplier.schema";
import { supplierApi, supplierQuery } from "../services/supplier.api";
import { BulkUploadDialog } from "../../components/BulkUploadDialog";

const PAGE_SIZES = [10, 25, 50, 100] as const;
const BREADCRUMBS = entityMasterDataBreadcrumbs(entityMasterDataPaths.supplierProfile);
const NONE = <span className="text-ink-faint">—</span>;

type Filters = Omit<SupplierFilters, "search">;

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];
const TYPE_OPTIONS = [
  { value: "local", label: "Local" },
  { value: "foreign", label: "Foreign" },
];

export function SupplierListView() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [filters, setFilters] = useState<Filters>({});
  const [pageSize, setPageSize] = useState<number>(10);
  const query: SupplierFilters = { search: debouncedSearch, ...filters };
  const queryKey = supplierQuery(query);
  // The requested page belongs to the search/filters it was chosen for; a new query starts on page 1.
  const [paging, setPaging] = useState({ page: 1, key: "" });
  const page = paging.key === queryKey ? paging.page : 1;
  const [uploadOpen, setUploadOpen] = useState(false);

  const list = useResource(`suppliers?${queryKey}&page=${page}&size=${pageSize}`, () =>
    supplierApi.list({ ...query, page, pageSize }),
  );
  const options = useResource("supplier-form-options", supplierApi.formOptions);

  // Keep the last page on screen while the next one loads.
  const [shown, setShown] = useState<SupplierList>();
  if (list.data && list.data !== shown) setShown(list.data);

  const goToPage = (next: number) => setPaging({ page: next, key: queryKey });

  // Partner groups of the chosen office's business unit (all groups when no office is chosen).
  const officeUnit = options.data?.offices.find((office) => office.id === filters.officeId)?.businessUnitId;
  const groupOptions = (options.data?.groups ?? [])
    .filter((group) => !group.parentId && (!officeUnit || group.businessUnitId === officeUnit))
    .map((group) => ({ value: group.id, label: group.name }));

  const changeFilter = (changes: Filters) => {
    const next = { ...filters, ...changes };
    // A group from another business unit no longer applies once the office changes.
    if ("officeId" in changes && next.groupId) {
      const unit = options.data?.offices.find((office) => office.id === next.officeId)?.businessUnitId;
      const group = options.data?.groups.find((item) => item.id === next.groupId);
      if (unit && group && group.businessUnitId !== unit) next.groupId = undefined;
    }
    setFilters(next);
  };
  const filtered = debouncedSearch !== "" || Object.values(filters).some(Boolean);
  const clearAll = () => {
    setSearch("");
    setFilters({});
  };
  const totalPages = shown ? Math.max(1, Math.ceil(shown.total / shown.pageSize)) : 1;
  const firstSerial = shown ? (shown.page - 1) * shown.pageSize + 1 : 1;

  return (
    <PageContainer full>
      <PageHead
        title="Supplier Profile"
        subtitle="Partners you buy from: details, billing and supplier addresses."
        breadcrumbs={BREADCRUMBS}
        actions={
          <>
            <label className="relative w-full sm:w-64">
              <span className="sr-only">Search suppliers</span>
              <Search aria-hidden="true" className="pointer-events-none absolute top-2 left-2.5 size-4 text-ink-faint" />
              <input
                type="search"
                value={search}
                maxLength={100}
                placeholder="Search code, name, mobile…"
                title="Searches partner code, name, mobile, email, BIN and TIN"
                onChange={(event) => setSearch(event.target.value)}
                className={cn(CONTROL_CLASS, "pl-8")}
              />
            </label>
            <a
              href={supplierApi.exportUrl(query)}
              download
              className={buttonClasses("secondary", "md")}
              title="Download the list, with the current search and filters, as an Excel file"
            >
              <FileSpreadsheet /> Excel Download
            </a>
            <Button onClick={() => setUploadOpen(true)}>
              <Upload /> Bulk Upload
            </Button>
            <Link href={entityMasterDataPaths.supplierCreate} className={buttonClasses("accent", "md")}>
              <Plus /> Add Supplier
            </Link>
          </>
        }
      />

      <section className="rounded border border-line bg-surface shadow-xs">
        <div role="group" aria-label="Filters" className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <Select
            aria-label="Office"
            className="w-full sm:w-52"
            value={filters.officeId ?? ""}
            placeholder="Office: All"
            options={(options.data?.offices ?? []).map((office) => ({ value: office.id, label: office.name }))}
            disabled={!options.data}
            onChange={(event) => changeFilter({ officeId: event.target.value || undefined })}
          />
          <Select
            aria-label="Partner group"
            className="w-full sm:w-52"
            value={filters.groupId ?? ""}
            placeholder="Partner Group: All"
            options={groupOptions}
            disabled={!options.data}
            onChange={(event) => changeFilter({ groupId: event.target.value || undefined })}
          />
          <Select
            aria-label="Active or inactive"
            className="w-full sm:w-44"
            value={filters.status ?? ""}
            placeholder="Active/Inactive: All"
            options={STATUS_OPTIONS}
            onChange={(event) => changeFilter({ status: (event.target.value || undefined) as Filters["status"] })}
          />
          <Select
            aria-label="Local or foreign"
            className="w-full sm:w-44"
            value={filters.type ?? ""}
            placeholder="Local/Foreign: All"
            options={TYPE_OPTIONS}
            onChange={(event) => changeFilter({ type: (event.target.value || undefined) as Filters["type"] })}
          />
          {filtered && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex h-8 items-center gap-1 rounded px-2 text-xs font-semibold text-accent-strong hover:bg-accent-soft focus-visible:outline-2 dark:text-accent"
            >
              <X aria-hidden="true" className="size-3.5" /> Clear
            </button>
          )}
          {shown && (
            <span className="ml-auto text-xs text-ink-faint tabular-nums" aria-live="polite">
              {shown.total} supplier{shown.total === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {list.error ? (
          <ErrorState message={list.error.message} onRetry={list.reload} />
        ) : !shown ? (
          <LoadingState label="Loading suppliers…" />
        ) : shown.total === 0 ? (
          <div className="p-5">
            {filtered ? (
              <EmptyBlock icon={<Search />} title="No matching suppliers">
                <p>Try a different search or filter.</p>
                <Button size="sm" className="mt-3" onClick={clearAll}>
                  Clear search &amp; filters
                </Button>
              </EmptyBlock>
            ) : (
              <EmptyBlock icon={<Truck />} title="No suppliers yet">
                <p>Add a supplier, or upload many at once from Excel.</p>
                <Link href={entityMasterDataPaths.supplierCreate} className={buttonClasses("accent", "sm", "mt-3")}>
                  <Plus /> Add Supplier
                </Link>
              </EmptyBlock>
            )}
          </div>
        ) : (
          <div className={cn("overflow-x-auto transition-opacity", list.loading && "opacity-60")} aria-busy={list.loading || undefined}>
            <table className="data-grid w-full min-w-max">
              <caption className="sr-only">Suppliers</caption>
              <thead>
                <tr>
                  {["SL", "Partner Code", "Partner Name", "Partner Group", "Billing Phone No", "Billing Address", "Type", "Status", "Action"].map(
                    (header) => (
                      <th key={header} scope="col" className="px-2.5 py-2 text-left">
                        {header}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {shown.rows.map((row, index) => (
                  <tr key={row.id}>
                    <td className="w-12 px-2.5 py-2 text-right text-ink-faint tabular-nums">{firstSerial + index}</td>
                    <td className="px-2.5 py-2 font-medium whitespace-nowrap text-ink">{row.code}</td>
                    <td className="px-2.5 py-2 whitespace-nowrap">
                      <Link
                        href={entityMasterDataPaths.supplierEdit(row.id)}
                        className="font-medium text-accent-strong hover:underline dark:text-accent"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="px-2.5 py-2 whitespace-nowrap">
                      {row.groupName ? (row.subGroupName ? `${row.groupName} › ${row.subGroupName}` : row.groupName) : NONE}
                    </td>
                    <td className="px-2.5 py-2 whitespace-nowrap tabular-nums">{row.billingContactNo ?? row.mobile ?? NONE}</td>
                    <td className="max-w-72 truncate px-2.5 py-2" title={row.billingAddress ?? undefined}>
                      {row.billingAddress ?? NONE}
                    </td>
                    <td className="px-2.5 py-2">
                      <span
                        className={cn(
                          "inline-flex h-5 items-center rounded border px-2 text-[10px] font-semibold tracking-wide uppercase",
                          row.isForeign
                            ? "border-warning/30 bg-warning/10 text-warning"
                            : "border-accent-line bg-accent-soft text-accent-strong dark:text-accent",
                        )}
                      >
                        {row.isForeign ? "Foreign" : "Local"}
                      </span>
                    </td>
                    <td className="px-2.5 py-2">
                      <StatusBadge active={row.isActive} />
                    </td>
                    <td className="w-14 px-1.5 py-1 text-center">
                      <Link
                        href={entityMasterDataPaths.supplierEdit(row.id)}
                        title="Edit supplier"
                        aria-label={`Edit ${row.name}`}
                        className={cn(buttonClasses("ghost", "icon"), "hover:bg-accent-soft hover:text-accent-strong")}
                      >
                        <Pencil aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {shown && shown.total > 0 && !list.error && (
          <div className="border-t border-line bg-canvas px-5 py-2.5">
            <Pagination
              page={shown.page}
              pageSize={pageSize}
              totalRecords={shown.total}
              totalPages={totalPages}
              pageSizes={PAGE_SIZES}
              onPageChange={goToPage}
              onPageSizeChange={(next) => {
                setPageSize(next);
                goToPage(1);
              }}
              disabled={list.loading}
              noun="suppliers"
            />
          </div>
        )}
      </section>

      <BulkUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onImported={() => {
          goToPage(1);
          list.reload();
        }}
        noun="suppliers"
        templateUrl={supplierApi.templateUrl}
        maxRows={MAX_IMPORT_ROWS}
        matchHint="Office, groups, district, thana and tax bracket must match existing names."
        upload={supplierApi.importFile}
      />
    </PageContainer>
  );
}
