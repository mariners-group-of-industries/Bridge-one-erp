"use client";

import { BadgePercent, Pencil, Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { entityMasterDataBreadcrumbs } from "@/features/configuration/entity-master-data/breadcrumbs";
import { CONTROL_CLASS, EmptyBlock, Select, StatusBadge } from "@/features/configuration/entity-master-data/employee/components/kit";
import { salesConfigPaths } from "../../paths";
import { OFFER_KINDS, slugFromKind, type OfferKind, type OfferList, type OfferListRow } from "../schemas/offer.schema";
import { offerApi } from "../services/offer.api";

const PAGE_SIZES = [10, 25, 50, 100] as const;
const BREADCRUMBS = entityMasterDataBreadcrumbs(salesConfigPaths.offerSetup);
const NONE = <span className="text-ink-faint">—</span>;
const TABS = OFFER_KINDS.map((entry) => ({ id: entry.kind, label: entry.label }));

const date = (value: string | null) => (value ? value.split("-").reverse().join("-") : NONE);

/** Third column per offer type (Items tab shows Customer Group, as specified). */
const GROUP_COLUMN: Record<OfferKind, { header: string; cell: (row: OfferListRow) => React.ReactNode }> = {
  ITEM: { header: "Customer Group", cell: (row) => row.customerGroupName ?? "All" },
  ITEM_MULTIPLE: { header: "Price Type", cell: (row) => row.priceListName ?? row.basedOn ?? NONE },
  DISCOUNT: { header: "Customer Group", cell: (row) => row.customerGroupName ?? row.basedOn ?? "All" },
  SPECIAL_DISCOUNT: { header: "Offer Based On", cell: (row) => row.basedOn ?? NONE },
};

export function OfferListView({ initialKind }: { initialKind: OfferKind }) {
  const router = useRouter();
  const pathname = usePathname();
  const [kind, setKind] = useState<OfferKind>(initialKind);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const changeKind = (next: OfferKind) => {
    setKind(next);
    // Keep the tab in the URL so reloads and links land on it.
    router.replace(`${pathname}?tab=${slugFromKind(next)}`, { scroll: false });
  };

  return (
    <PageContainer full>
      <PageHead
        title="Offer Setup"
        subtitle="Item offers, combination offers, item discounts and invoice-amount discounts."
        breadcrumbs={BREADCRUMBS}
        actions={
          <>
            <form
              role="search"
              className="flex w-full items-center gap-2 sm:w-auto"
              onSubmit={(event) => {
                event.preventDefault();
                setSearch(searchText.trim());
              }}
            >
              <label className="relative w-full sm:w-60">
                <span className="sr-only">Search offers</span>
                <Search aria-hidden="true" className="pointer-events-none absolute top-2 left-2.5 size-4 text-ink-faint" />
                <input
                  type="search"
                  value={searchText}
                  maxLength={100}
                  placeholder="Search offer name…"
                  onChange={(event) => {
                    setSearchText(event.target.value);
                    if (event.target.value === "") setSearch("");
                  }}
                  className={cn(CONTROL_CLASS, "pl-8")}
                />
              </label>
              <Button type="submit">
                <Search /> Search
              </Button>
            </form>
            <Link href={salesConfigPaths.offerCreate(slugFromKind(kind))} className={buttonClasses("accent", "md")}>
              <Plus /> Create Offer
            </Link>
          </>
        }
      />

      <section className="rounded border border-line bg-surface shadow-xs">
        <Tabs tabs={TABS} value={kind} onChange={changeKind} label="Offer types">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <Select
              aria-label="Status"
              className="w-44"
              value={status}
              placeholder="Status: All"
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
              onChange={(event) => setStatus(event.target.value)}
            />
          </div>
          <OfferTable key={kind} kind={kind} search={search} status={status} />
        </Tabs>
      </section>
    </PageContainer>
  );
}

function OfferTable({ kind, search, status }: { kind: OfferKind; search: string; status: string }) {
  const toast = useToast();
  const [pageSize, setPageSize] = useState<number>(10);
  const queryKey = `${search}|${status}`;
  const [paging, setPaging] = useState({ page: 1, key: queryKey });
  const page = paging.key === queryKey ? paging.page : 1;
  const [refresh, setRefresh] = useState(0);
  const list = useResource(`offers?${kind}&${queryKey}&${page}&${pageSize}&${refresh}`, () =>
    offerApi.list({ kind, search, status, page, pageSize }),
  );
  const [shown, setShown] = useState<OfferList>();
  if (list.data && list.data !== shown) setShown(list.data);
  const [busyId, setBusyId] = useState<string | null>(null);
  const goToPage = (next: number) => setPaging({ page: next, key: queryKey });
  const column = GROUP_COLUMN[kind];

  const toggle = async (row: OfferListRow) => {
    setBusyId(row.id);
    try {
      await offerApi.setActive(row.id, !row.isActive);
      toast.success(`${row.name} is now ${row.isActive ? "inactive" : "active"}.`);
      setRefresh((value) => value + 1);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  if (list.error) return <ErrorState message={list.error.message} onRetry={list.reload} />;
  if (!shown) return <LoadingState label="Loading offers…" />;
  if (shown.total === 0) {
    return (
      <div className="p-5">
        <EmptyBlock icon={<BadgePercent />} title={search || status ? "No matching offers" : "No offers yet"}>
          {search || status ? (
            "Try a different search or status."
          ) : (
            <Link href={salesConfigPaths.offerCreate(slugFromKind(kind))} className={buttonClasses("accent", "sm", "mt-3")}>
              <Plus /> Create Offer
            </Link>
          )}
        </EmptyBlock>
      </div>
    );
  }

  const first = (shown.page - 1) * shown.pageSize + 1;
  return (
    <>
      <div className={cn("overflow-x-auto transition-opacity", list.loading && "opacity-60")} aria-busy={list.loading || undefined}>
        <table className="data-grid w-full min-w-max">
          <thead>
            <tr>
              {["SL", "Action", "From Date", "To Date", column.header, "Offer Name", "Status"].map((header) => (
                <th key={header} scope="col" className="px-2.5 py-2 text-left">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.rows.map((row, index) => (
              <tr key={row.id}>
                <td className="w-12 px-2.5 py-2 text-right text-ink-faint tabular-nums">{first + index}</td>
                <td className="w-24 px-1.5 py-1">
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
                      href={salesConfigPaths.offerEdit(row.id)}
                      title="Edit offer"
                      aria-label={`Edit ${row.name}`}
                      className={cn(buttonClasses("ghost", "icon"), "hover:bg-accent-soft hover:text-accent-strong")}
                    >
                      <Pencil aria-hidden="true" />
                    </Link>
                  </div>
                </td>
                <td className="px-2.5 py-2 whitespace-nowrap tabular-nums">{date(row.fromDate)}</td>
                <td className="px-2.5 py-2 whitespace-nowrap tabular-nums">{date(row.toDate)}</td>
                <td className="px-2.5 py-2 whitespace-nowrap">{column.cell(row)}</td>
                <td className="px-2.5 py-2 whitespace-nowrap">
                  <Link href={salesConfigPaths.offerEdit(row.id)} className="font-medium text-accent-strong hover:underline dark:text-accent">
                    {row.name}
                  </Link>
                  <span className="ml-2 text-xs text-ink-faint">({row.lineCount} row{row.lineCount === 1 ? "" : "s"})</span>
                </td>
                <td className="px-2.5 py-2">
                  <StatusBadge active={row.isActive} />
                </td>
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
          noun="offers"
        />
      </div>
    </>
  );
}
