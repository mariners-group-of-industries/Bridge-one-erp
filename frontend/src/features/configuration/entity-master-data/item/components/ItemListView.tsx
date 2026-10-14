"use client";

import { PackagePlus, Pencil, Plus, Search, Upload, Warehouse } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { entityMasterDataBreadcrumbs } from "../../breadcrumbs";
import { BulkUploadDialog } from "../../components/BulkUploadDialog";
import { CONTROL_CLASS, EmptyBlock, StatusBadge } from "../../employee/components/kit";
import { entityMasterDataPaths } from "../../paths";
import { MAX_ITEM_IMPORT_ROWS, type ItemList, type ItemListRow } from "../schemas/item.schema";
import { itemApi } from "../services/item.api";
import { CategoryTab } from "./CategoryTab";

const PAGE_SIZES = [10, 25, 50, 100] as const;
const BREADCRUMBS = entityMasterDataBreadcrumbs(entityMasterDataPaths.itemProfile);
const NONE = <span className="text-ink-faint">—</span>;
const TABS = [
  { id: "items", label: "Item Profile" },
  { id: "categories", label: "Category" },
] as const;

const money = (value: string | null) =>
  value === null ? NONE : Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (value: string) => Number(value).toLocaleString("en-US", { maximumFractionDigits: 3 });
const date = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-");
const text = (value: string | null) => value ?? NONE;

/** Item Profile columns after SL and Action, in the required order. */
const COLUMNS: { header: string; className?: string; cell: (row: ItemListRow) => ReactNode }[] = [
  { header: "Status", cell: (row) => <StatusBadge active={row.isActive} /> },
  { header: "Date", className: "whitespace-nowrap tabular-nums", cell: (row) => date(row.createdAt) },
  {
    header: "Code",
    className: "whitespace-nowrap",
    cell: (row) => (
      <Link href={entityMasterDataPaths.itemEdit(row.id)} className="font-medium text-accent-strong hover:underline dark:text-accent">
        {row.code}
      </Link>
    ),
  },
  { header: "Barcode", className: "whitespace-nowrap tabular-nums", cell: (row) => text(row.barcode) },
  { header: "Printed Item Code", className: "whitespace-nowrap", cell: (row) => text(row.printedCode) },
  { header: "Item Name", className: "whitespace-nowrap font-medium text-ink", cell: (row) => row.name },
  { header: "Item Type", className: "whitespace-nowrap", cell: (row) => text(row.itemType) },
  { header: "Item Division", className: "whitespace-nowrap", cell: (row) => text(row.divisionName) },
  { header: "Category", className: "whitespace-nowrap", cell: (row) => text(row.categoryName) },
  { header: "Sub Category", className: "whitespace-nowrap", cell: (row) => text(row.subCategoryName) },
  { header: "Minor Category", className: "whitespace-nowrap", cell: (row) => text(row.minorCategoryName) },
  { header: "Brand", className: "whitespace-nowrap", cell: (row) => text(row.brand) },
  { header: "UoM", className: "whitespace-nowrap", cell: (row) => row.uom },
  { header: "Net Weight Unit", className: "whitespace-nowrap", cell: (row) => text(row.netWeightUnit) },
  { header: "Current Stock", className: "text-right tabular-nums", cell: (row) => qty(row.currentStock) },
  { header: "Selling Price", className: "text-right tabular-nums", cell: (row) => money(row.sellingPrice) },
  { header: "Retail Price", className: "text-right tabular-nums", cell: (row) => money(row.retailPrice) },
  { header: "Dealer Price", className: "text-right tabular-nums", cell: (row) => money(row.dealerPrice) },
  { header: "Trading Price", className: "text-right tabular-nums", cell: (row) => money(row.tradingPrice) },
  { header: "Purchase Price", className: "text-right tabular-nums", cell: (row) => money(row.purchasePrice) },
  { header: "Last Cost", className: "text-right tabular-nums", cell: (row) => money(row.lastCost) },
  { header: "Avg Cost", className: "text-right tabular-nums", cell: (row) => money(row.avgCost) },
  { header: "VAT %", className: "text-right tabular-nums", cell: (row) => qty(row.vatPercent) },
];

export function ItemListView() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("items");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);

  return (
    <PageContainer full>
      <PageHead
        title="Item Profile"
        subtitle="Items, categories and opening stock. Items are shared with Sales and Purchase."
        breadcrumbs={BREADCRUMBS}
        actions={
          <>
            <label className="relative w-full sm:w-64">
              <span className="sr-only">Search items</span>
              <Search aria-hidden="true" className="pointer-events-none absolute top-2 left-2.5 size-4 text-ink-faint" />
              <input
                type="search"
                value={search}
                maxLength={100}
                placeholder="Search code, name, barcode…"
                title="Searches item code, name, printed code/name, barcode and brand"
                onChange={(event) => setSearch(event.target.value)}
                className={cn(CONTROL_CLASS, "pl-8")}
              />
            </label>
            <Link href={entityMasterDataPaths.itemOpeningStock} className={buttonClasses("secondary", "md")}>
              <Warehouse /> Opening Stock
            </Link>
            <Button onClick={() => setUploadOpen(true)}>
              <Upload /> Bulk Upload
            </Button>
            <Link href={entityMasterDataPaths.itemCreate} className={buttonClasses("accent", "md")}>
              <Plus /> Add Item
            </Link>
          </>
        }
      />

      <section className="rounded border border-line bg-surface shadow-xs">
        <Tabs tabs={TABS} value={tab} onChange={setTab} label="Item Profile sections">
          {tab === "items" ? <ItemsTab search={debouncedSearch} refresh={refresh} onRefresh={() => setRefresh((v) => v + 1)} /> : <CategoryTab search={debouncedSearch} />}
        </Tabs>
      </section>

      <BulkUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onImported={() => setRefresh((value) => value + 1)}
        noun="items"
        templateUrl={itemApi.templateUrl}
        maxRows={MAX_ITEM_IMPORT_ROWS}
        matchHint="Division, category, sub category and minor category must match existing names."
        upload={itemApi.importFile}
      />
    </PageContainer>
  );
}

function ItemsTab({ search, refresh, onRefresh }: { search: string; refresh: number; onRefresh: () => void }) {
  const toast = useToast();
  const [pageSize, setPageSize] = useState<number>(10);
  const [paging, setPaging] = useState({ page: 1, search });
  const page = paging.search === search ? paging.page : 1;
  const list = useResource(`items?${search}&${page}&${pageSize}&r=${refresh}`, () => itemApi.list({ search, page, pageSize }));
  const [shown, setShown] = useState<ItemList>();
  if (list.data && list.data !== shown) setShown(list.data);
  const [busyId, setBusyId] = useState<string | null>(null);
  const goToPage = (next: number) => setPaging({ page: next, search });

  const toggle = async (row: ItemListRow) => {
    setBusyId(row.id);
    try {
      await itemApi.setActive(row.id, !row.isActive);
      toast.success(`${row.name} is now ${row.isActive ? "inactive" : "active"}.`);
      onRefresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  if (list.error) return <ErrorState message={list.error.message} onRetry={list.reload} />;
  if (!shown) return <LoadingState label="Loading items…" />;
  if (shown.total === 0) {
    return (
      <div className="p-5">
        {search ? (
          <EmptyBlock icon={<Search />} title="No matching items">
            Try a different search.
          </EmptyBlock>
        ) : (
          <EmptyBlock icon={<PackagePlus />} title="No items yet">
            <p>Add an item, or upload many at once from Excel.</p>
            <Link href={entityMasterDataPaths.itemCreate} className={buttonClasses("accent", "sm", "mt-3")}>
              <Plus /> Add Item
            </Link>
          </EmptyBlock>
        )}
      </div>
    );
  }

  const first = (shown.page - 1) * shown.pageSize + 1;
  return (
    <>
      <div className={cn("overflow-x-auto transition-opacity", list.loading && "opacity-60")} aria-busy={list.loading || undefined}>
        <table className="data-grid w-full min-w-max">
          <caption className="sr-only">Items</caption>
          <thead>
            <tr>
              <th scope="col" className="w-12 px-2.5 py-2 text-left">SL</th>
              <th scope="col" className="px-2.5 py-2 text-center">Action</th>
              {COLUMNS.map((column) => (
                <th key={column.header} scope="col" className="px-2.5 py-2 text-left">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.rows.map((row, index) => (
              <tr key={row.id}>
                <td className="px-2.5 py-2 text-right text-ink-faint tabular-nums">{first + index}</td>
                <td className="px-1.5 py-1">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={row.isActive}
                      aria-label={`${row.name} is ${row.isActive ? "active" : "inactive"}; click to ${row.isActive ? "deactivate" : "activate"}`}
                      title={row.isActive ? "Active: click to deactivate" : "Inactive: click to activate"}
                      disabled={busyId === row.id}
                      onClick={() => toggle(row)}
                      className={cn(
                        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-2 disabled:opacity-50",
                        row.isActive ? "border-success bg-success" : "border-line-strong bg-control",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn("inline-block size-3.5 rounded-full bg-white shadow-xs transition-transform", row.isActive ? "translate-x-[18px]" : "translate-x-0.5")}
                      />
                    </button>
                    <Link
                      href={entityMasterDataPaths.itemEdit(row.id)}
                      title="Edit item"
                      aria-label={`Edit ${row.name}`}
                      className={cn(buttonClasses("ghost", "icon"), "hover:bg-accent-soft hover:text-accent-strong")}
                    >
                      <Pencil aria-hidden="true" />
                    </Link>
                  </div>
                </td>
                {COLUMNS.map((column) => (
                  <td key={column.header} className={cn("px-2.5 py-2", column.className)}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
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
          noun="items"
        />
      </div>
    </>
  );
}
