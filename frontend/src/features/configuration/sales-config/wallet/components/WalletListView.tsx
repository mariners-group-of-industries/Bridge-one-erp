"use client";

import { Pencil, Plus, Search, Trash2, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { entityMasterDataBreadcrumbs } from "@/features/configuration/entity-master-data/breadcrumbs";
import { CONTROL_CLASS, EmptyBlock } from "@/features/configuration/entity-master-data/employee/components/kit";
import { salesConfigPaths } from "../../paths";
import type { WalletList, WalletRow } from "../schemas/wallet.schema";
import { walletApi } from "../services/wallet.api";

const PAGE_SIZES = [10, 25, 50, 100] as const;
const BREADCRUMBS = entityMasterDataBreadcrumbs(salesConfigPaths.walletSetup);
const HEADERS = ["SL", "Action", "Wallet Name", "Wallet Commission (%)", "Account No", "Reference Code", "Is Rounding", "Is Coupon", "Is Wallet Charge"];

function YesNo({ on }: { on: boolean }) {
  return (
    <span className={cn("inline-flex rounded border px-1.5 text-xs font-medium", on ? "border-accent-line bg-accent-soft text-accent-strong dark:text-accent" : "border-line text-ink-faint")}>
      {on ? "Yes" : "No"}
    </span>
  );
}

export function WalletListView() {
  const toast = useToast();
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState<number>(25);
  const [paging, setPaging] = useState({ page: 1, search: "" });
  const page = paging.search === search ? paging.page : 1;
  const list = useResource(`wallets?${search}&p=${page}&s=${pageSize}`, () => walletApi.list({ search, page, pageSize }));
  const [shown, setShown] = useState<WalletList>();
  if (list.data && list.data !== shown) setShown(list.data);
  const [deleting, setDeleting] = useState<WalletRow | null>(null);
  const [busy, setBusy] = useState(false);
  const goToPage = (next: number) => setPaging({ page: next, search });

  return (
    <PageContainer full>
      <PageHead
        title="Wallet Setup"
        subtitle="Payment wallets (cash, bank and MFS) with their commission and settlement account."
        breadcrumbs={BREADCRUMBS}
        actions={
          <>
            <form
              role="search"
              className="relative w-full sm:w-60"
              onSubmit={(event) => {
                event.preventDefault();
                setSearch(searchText.trim());
              }}
            >
              <label>
                <span className="sr-only">Search wallets (press Enter)</span>
                <Search aria-hidden="true" className="pointer-events-none absolute top-2 left-2.5 size-4 text-ink-faint" />
                <input
                  type="search"
                  value={searchText}
                  maxLength={100}
                  placeholder="Name, account or reference… (Enter)"
                  onChange={(event) => {
                    setSearchText(event.target.value);
                    if (event.target.value === "") setSearch("");
                  }}
                  className={cn(CONTROL_CLASS, "pl-8")}
                />
              </label>
            </form>
            <Link href={salesConfigPaths.walletNew} className={buttonClasses("accent", "md")}>
              <Plus /> Add Wallet
            </Link>
          </>
        }
      />

      <section className="rounded border border-line bg-surface shadow-xs">
        {list.error ? (
          <ErrorState message={list.error.message} onRetry={list.reload} />
        ) : !shown ? (
          <LoadingState label="Loading wallets…" />
        ) : shown.total === 0 ? (
          <div className="p-5">
            <EmptyBlock icon={<Wallet />} title={search ? "No matching wallets" : "No wallets yet"}>
              {search ? (
                "Try a different search."
              ) : (
                <Link href={salesConfigPaths.walletNew} className={buttonClasses("accent", "sm", "mt-3")}>
                  <Plus /> Add Wallet
                </Link>
              )}
            </EmptyBlock>
          </div>
        ) : (
          <>
            <div className={cn("overflow-x-auto transition-opacity", list.loading && "opacity-60")}>
              <table className="data-grid w-full min-w-max">
                <thead>
                  <tr>
                    {HEADERS.map((h) => (
                      <th key={h} scope="col" className="px-2.5 py-2 text-left whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.rows.map((row, index) => (
                    <tr key={row.id}>
                      <td className="w-12 px-2.5 py-2 text-right text-ink-faint tabular-nums">{(shown.page - 1) * shown.pageSize + index + 1}</td>
                      <td className="w-24 px-1.5 py-1">
                        <div className="flex items-center justify-center gap-1">
                          <Link
                            href={salesConfigPaths.walletEdit(row.id)}
                            title="Edit"
                            aria-label={`Edit ${row.name}`}
                            className={cn(buttonClasses("ghost", "icon"), "hover:bg-accent-soft hover:text-accent-strong")}
                          >
                            <Pencil aria-hidden="true" />
                          </Link>
                          <Button variant="ghost" size="icon" className="hover:text-danger" aria-label={`Delete ${row.name}`} title="Delete" onClick={() => setDeleting(row)}>
                            <Trash2 />
                          </Button>
                        </div>
                      </td>
                      <td className="px-2.5 py-2 whitespace-nowrap">
                        <Link href={salesConfigPaths.walletEdit(row.id)} className="font-medium text-accent-strong hover:underline dark:text-accent">
                          {row.name}
                        </Link>
                      </td>
                      <td className="px-2.5 py-2 text-right tabular-nums">{row.commissionPercent}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap tabular-nums">{row.isCash ? <span className="text-ink-faint">Cash</span> : (row.accountNo ?? "—")}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap">{row.referenceCode ?? <span className="text-ink-faint">—</span>}</td>
                      <td className="px-2.5 py-2">
                        <YesNo on={row.isRounding} />
                      </td>
                      <td className="px-2.5 py-2">
                        <YesNo on={row.isCoupon} />
                      </td>
                      <td className="px-2.5 py-2">
                        <YesNo on={row.isWalletCharge} />
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
                noun="wallets"
              />
            </div>
          </>
        )}
      </section>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete wallet?"
        message={deleting ? `Delete the wallet "${deleting.name}"? This cannot be undone.` : ""}
        busy={busy}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          setBusy(true);
          try {
            await walletApi.remove(deleting.id);
            toast.success(`Wallet "${deleting.name}" deleted.`);
            setDeleting(null);
            list.reload();
          } catch (err) {
            toast.error(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      />
    </PageContainer>
  );
}
