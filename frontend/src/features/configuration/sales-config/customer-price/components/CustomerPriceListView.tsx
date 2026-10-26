"use client";

import { FileSpreadsheet, FileText, Pencil, Plus, Search, Tags, Upload } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
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
import { BulkUploadDialog } from "@/features/configuration/entity-master-data/components/BulkUploadDialog";
import { CONTROL_CLASS, EmptyBlock, StatusBadge } from "@/features/configuration/entity-master-data/employee/components/kit";
import { salesConfigPaths } from "../../paths";
import { PRICE_TABS, slugFromTab, type PriceTab } from "../schemas/customer-price.schema";
import { customerPriceApi } from "../services/customer-price.api";

const PAGE_SIZES = [10, 25, 50, 100] as const;
const BREADCRUMBS = entityMasterDataBreadcrumbs(salesConfigPaths.customerPriceSetup);
const NONE = <span className="text-ink-faint">—</span>;
const TABS = PRICE_TABS.map((tab) => ({ id: tab.id, label: tab.label }));
const date = (value: string) => value.slice(0, 10).split("-").reverse().join("-");

export function CustomerPriceListView({ initialTab }: { initialTab: PriceTab }) {
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<PriceTab>(initialTab);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);

  const changeTab = (next: PriceTab) => {
    setTab(next);
    router.replace(`${pathname}?tab=${slugFromTab(next)}`, { scroll: false });
  };

  return (
    <PageContainer full>
      <PageHead
        title="Customer Price Setup"
        subtitle="Customer-specific DP/TP prices and customer-group prices by date and quantity."
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
                <span className="sr-only">Search prices (press Enter)</span>
                <Search aria-hidden="true" className="pointer-events-none absolute top-2 left-2.5 size-4 text-ink-faint" />
                <input
                  type="search"
                  value={searchText}
                  maxLength={100}
                  placeholder={tab === "customer" ? "Customer or item… (Enter)" : "Group, office, circular or item… (Enter)"}
                  onChange={(event) => {
                    setSearchText(event.target.value);
                    if (event.target.value === "") setSearch("");
                  }}
                  className={cn(CONTROL_CLASS, "pl-8")}
                />
              </label>
            </form>
            <a href={customerPriceApi.pdfUrl(tab, search)} target="_blank" rel="noopener noreferrer" className={buttonClasses("secondary", "md")} title="Open the list as a PDF">
              <FileText /> PDF Print
            </a>
            <a href={customerPriceApi.exportUrl(tab, search)} download className={buttonClasses("secondary", "md")} title="Download the list as an Excel file">
              <FileSpreadsheet /> Excel Download
            </a>
            <Button onClick={() => setUploadOpen(true)}>
              <Upload /> Bulk Upload
            </Button>
            <Link href={salesConfigPaths.customerPriceNew(slugFromTab(tab))} className={buttonClasses("accent", "md")}>
              <Plus /> Price Setup
            </Link>
          </>
        }
      />

      <section className="rounded border border-line bg-surface shadow-xs">
        <Tabs tabs={TABS} value={tab} onChange={changeTab} label="Price setups">
          {tab === "customer" ? <CustomerTable key="customer" search={search} refresh={refresh} /> : <GroupTable key="group" search={search} refresh={refresh} />}
        </Tabs>
      </section>

      <BulkUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onImported={() => setRefresh((value) => value + 1)}
        noun={tab === "customer" ? "customer price setups" : "customer group price setups"}
        templateUrl={customerPriceApi.templateUrl(tab)}
        maxRows={5000}
        matchHint={
          tab === "customer"
            ? "Customer code, price type and item code must match existing records; prices are merged into the customer's setup."
            : "Office, customer group, price type and item code must match existing records."
        }
        upload={async (file) => {
          const result = await customerPriceApi.importFile(tab, file);
          return { created: result.created + result.updated, errors: result.errors };
        }}
      />
    </PageContainer>
  );
}

// ─── Tables ───────────────────────────────────────────────────────────────────

function usePaged<T>(key: string, load: (page: number, pageSize: number) => Promise<{ rows: T[]; total: number; page: number; pageSize: number }>) {
  const [pageSize, setPageSize] = useState<number>(10);
  const [paging, setPaging] = useState({ page: 1, key });
  const page = paging.key === key ? paging.page : 1;
  const list = useResource(`${key}&p=${page}&s=${pageSize}`, () => load(page, pageSize));
  const [shown, setShown] = useState<typeof list.data>();
  if (list.data && list.data !== shown) setShown(list.data);
  return { list, shown, pageSize, setPageSize, goToPage: (next: number) => setPaging({ page: next, key }) };
}

function Toggle({ on, label, busy, onClick }: { on: boolean; label: string; busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={label}
      disabled={busy}
      onClick={onClick}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-2 disabled:opacity-50",
        on ? "border-success bg-success" : "border-line-strong bg-control",
      )}
    >
      <span aria-hidden="true" className={cn("inline-block size-3.5 rounded-full bg-white shadow-xs transition-transform", on ? "translate-x-[18px]" : "translate-x-0.5")} />
    </button>
  );
}

function Grid({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <table className="data-grid w-full min-w-max">
      <thead>
        <tr>
          {headers.map((header) => (
            <th key={header} scope="col" className="px-2.5 py-2 text-left">{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function Footer({ shown, pageSize, setPageSize, goToPage, loading, noun }: { shown: { total: number; page: number; pageSize: number }; pageSize: number; setPageSize: (n: number) => void; goToPage: (n: number) => void; loading: boolean; noun: string }) {
  return (
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
        disabled={loading}
        noun={noun}
      />
    </div>
  );
}

function Empty({ tab, search }: { tab: PriceTab; search: string }) {
  return (
    <div className="p-5">
      <EmptyBlock icon={<Tags />} title={search ? "No matching prices" : "No prices set up yet"}>
        {search ? (
          "Try a different search."
        ) : (
          <Link href={salesConfigPaths.customerPriceNew(slugFromTab(tab))} className={buttonClasses("accent", "sm", "mt-3")}>
            <Plus /> Price Setup
          </Link>
        )}
      </EmptyBlock>
    </div>
  );
}

function EditLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} title="Edit" aria-label={label} className={cn(buttonClasses("ghost", "icon"), "hover:bg-accent-soft hover:text-accent-strong")}>
      <Pencil aria-hidden="true" />
    </Link>
  );
}

function CustomerTable({ search, refresh }: { search: string; refresh: number }) {
  const toast = useToast();
  const [bump, setBump] = useState(0);
  const { list, shown, ...paging } = usePaged(`customer-prices?${search}&${refresh}&${bump}`, (page, pageSize) => customerPriceApi.listCustomer({ search, page, pageSize }));
  const [busyId, setBusyId] = useState<string | null>(null);

  if (list.error) return <ErrorState message={list.error.message} onRetry={list.reload} />;
  if (!shown) return <LoadingState label="Loading customer prices…" />;
  if (shown.total === 0) return <Empty tab="customer" search={search} />;
  const first = (shown.page - 1) * shown.pageSize + 1;

  return (
    <>
      <div className={cn("overflow-x-auto transition-opacity", list.loading && "opacity-60")}>
        <Grid headers={["SL", "Action", "Customer Code", "Customer Name", "Price Type", "Items", "Last Updated", "Status"]}>
          {shown.rows.map((row, index) => (
            <tr key={row.id}>
              <td className="w-12 px-2.5 py-2 text-right text-ink-faint tabular-nums">{first + index}</td>
              <td className="w-24 px-1.5 py-1">
                <div className="flex items-center justify-center gap-1">
                  <Toggle
                    on={row.isActive}
                    busy={busyId === row.id}
                    label={row.isActive ? "Active: click to deactivate" : "Inactive: click to activate"}
                    onClick={async () => {
                      setBusyId(row.id);
                      try {
                        await customerPriceApi.setCustomerActive(row.id, !row.isActive);
                        setBump((v) => v + 1);
                      } catch (err) {
                        toast.error(errorMessage(err));
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  />
                  <EditLink href={salesConfigPaths.customerPriceEdit("customer", row.id)} label={`Edit prices of ${row.customerName}`} />
                </div>
              </td>
              <td className="px-2.5 py-2 font-medium whitespace-nowrap">{row.customerCode}</td>
              <td className="px-2.5 py-2 whitespace-nowrap">
                <Link href={salesConfigPaths.customerPriceEdit("customer", row.id)} className="font-medium text-accent-strong hover:underline dark:text-accent">
                  {row.customerName}
                </Link>
              </td>
              <td className="px-2.5 py-2 whitespace-nowrap">{row.priceListName ?? NONE}</td>
              <td className="px-2.5 py-2 text-right tabular-nums">{row.itemCount}</td>
              <td className="px-2.5 py-2 whitespace-nowrap tabular-nums">{date(row.updatedAt)}</td>
              <td className="px-2.5 py-2"><StatusBadge active={row.isActive} /></td>
            </tr>
          ))}
        </Grid>
      </div>
      <Footer shown={shown} {...paging} loading={list.loading} noun="setups" />
    </>
  );
}

function GroupTable({ search, refresh }: { search: string; refresh: number }) {
  const toast = useToast();
  const [bump, setBump] = useState(0);
  const { list, shown, ...paging } = usePaged(`group-prices?${search}&${refresh}&${bump}`, (page, pageSize) => customerPriceApi.listGroup({ search, page, pageSize }));
  const [busyId, setBusyId] = useState<string | null>(null);

  if (list.error) return <ErrorState message={list.error.message} onRetry={list.reload} />;
  if (!shown) return <LoadingState label="Loading customer group prices…" />;
  if (shown.total === 0) return <Empty tab="group" search={search} />;
  const first = (shown.page - 1) * shown.pageSize + 1;

  return (
    <>
      <div className={cn("overflow-x-auto transition-opacity", list.loading && "opacity-60")}>
        <Grid headers={["SL", "Action", "Create Date", "Office", "Customer Group", "Price Type", "Circular/Notice", "Items", "Price Running"]}>
          {shown.rows.map((row, index) => (
            <tr key={row.id}>
              <td className="w-12 px-2.5 py-2 text-right text-ink-faint tabular-nums">{first + index}</td>
              <td className="w-24 px-1.5 py-1">
                <div className="flex items-center justify-center gap-1">
                  <Toggle
                    on={row.isRunning}
                    busy={busyId === row.id}
                    label={row.isRunning ? "Price running: click to stop" : "Price stopped: click to run"}
                    onClick={async () => {
                      setBusyId(row.id);
                      try {
                        await customerPriceApi.setGroupRunning(row.id, !row.isRunning);
                        setBump((v) => v + 1);
                      } catch (err) {
                        toast.error(errorMessage(err));
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  />
                  <EditLink href={salesConfigPaths.customerPriceEdit("group", row.id)} label={`Edit ${row.customerGroupName} prices`} />
                </div>
              </td>
              <td className="px-2.5 py-2 whitespace-nowrap tabular-nums">{date(row.createDate)}</td>
              <td className="px-2.5 py-2 whitespace-nowrap">{row.officeName}</td>
              <td className="px-2.5 py-2 whitespace-nowrap">
                <Link href={salesConfigPaths.customerPriceEdit("group", row.id)} className="font-medium text-accent-strong hover:underline dark:text-accent">
                  {row.customerGroupName}
                </Link>
              </td>
              <td className="px-2.5 py-2 whitespace-nowrap">{row.priceListName ?? NONE}</td>
              <td className="px-2.5 py-2 whitespace-nowrap">{row.circularNo ?? NONE}</td>
              <td className="px-2.5 py-2 text-right tabular-nums">{row.itemCount}</td>
              <td className="px-2.5 py-2">
                <span
                  className={cn(
                    "inline-flex h-5 items-center rounded border px-2 text-[10px] font-semibold tracking-wide uppercase",
                    row.isRunning ? "border-success/30 bg-success/10 text-success" : "border-line-strong bg-control text-ink-muted",
                  )}
                >
                  {row.isRunning ? "Running" : "Stopped"}
                </span>
              </td>
            </tr>
          ))}
        </Grid>
      </div>
      <Footer shown={shown} {...paging} loading={list.loading} noun="setups" />
    </>
  );
}
