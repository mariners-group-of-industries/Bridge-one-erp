"use client";

import { Pencil, Plus, Search, Trash2, Users } from "lucide-react";
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
import { securityPaths } from "../../paths";
import type { GroupList, GroupRow } from "../schemas/groups.schema";
import { permissionGroupApi, userGroupApi } from "../services/groups.api";

const PAGE_SIZES = [10, 25, 50, 100] as const;
const dateTime = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });

const KINDS = {
  user: {
    title: "User Group",
    noun: "user group",
    subtitle: "Named groups of users.",
    path: securityPaths.userGroup,
    newPath: securityPaths.userGroupNew,
    editPath: securityPaths.userGroupEdit,
    api: userGroupApi,
    countLabel: "Users",
  },
  permission: {
    title: "Permission Group",
    noun: "permission group",
    subtitle: "Permission matrices: Create, Edit, View, Delete and Approve per activity.",
    path: securityPaths.permissionGroup,
    newPath: securityPaths.permissionGroupNew,
    editPath: securityPaths.permissionGroupEdit,
    api: permissionGroupApi,
    countLabel: "Activities",
  },
} as const;

/** List of user groups or permission groups (same columns and actions). */
export function GroupListView({ kind }: { kind: keyof typeof KINDS }) {
  const config = KINDS[kind];
  const toast = useToast();
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState<number>(25);
  const [paging, setPaging] = useState({ page: 1, search: "" });
  const page = paging.search === search ? paging.page : 1;
  const list = useResource(`${kind}-groups?${search}&p=${page}&s=${pageSize}`, () => config.api.list({ search, page, pageSize }));
  const [shown, setShown] = useState<GroupList>();
  if (list.data && list.data !== shown) setShown(list.data);
  const [deleting, setDeleting] = useState<GroupRow | null>(null);
  const [busy, setBusy] = useState(false);
  const goToPage = (next: number) => setPaging({ page: next, search });
  const headers = ["SL", "Action", "Group Name", config.countLabel, "Last Action By", "Last Action Date & Time"];

  return (
    <PageContainer full>
      <PageHead
        title={config.title}
        subtitle={config.subtitle}
        breadcrumbs={entityMasterDataBreadcrumbs(config.path)}
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
                <span className="sr-only">Search groups (press Enter)</span>
                <Search aria-hidden="true" className="pointer-events-none absolute top-2 left-2.5 size-4 text-ink-faint" />
                <input
                  type="search"
                  value={searchText}
                  maxLength={100}
                  placeholder="Group name or last action by… (Enter)"
                  onChange={(event) => {
                    setSearchText(event.target.value);
                    if (event.target.value === "") setSearch("");
                  }}
                  className={cn(CONTROL_CLASS, "pl-8")}
                />
              </label>
            </form>
            <Link href={config.newPath} className={buttonClasses("accent", "md")}>
              <Plus /> Add {config.title}
            </Link>
          </>
        }
      />

      <section className="rounded border border-line bg-surface shadow-xs">
        {list.error ? (
          <ErrorState message={list.error.message} onRetry={list.reload} />
        ) : !shown ? (
          <LoadingState label="Loading groups…" />
        ) : shown.total === 0 ? (
          <div className="p-5">
            <EmptyBlock icon={<Users />} title={search ? "No matching groups" : `No ${config.noun}s yet`}>
              {search ? (
                "Try a different search."
              ) : (
                <Link href={config.newPath} className={buttonClasses("accent", "sm", "mt-3")}>
                  <Plus /> Add {config.title}
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
                    {headers.map((h) => (
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
                            href={config.editPath(row.id)}
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
                        <Link href={config.editPath(row.id)} className="font-medium text-accent-strong hover:underline dark:text-accent">
                          {row.name}
                        </Link>
                      </td>
                      <td className="px-2.5 py-2 text-right tabular-nums">{row.count}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap">{row.lastActionBy ?? <span className="text-ink-faint">—</span>}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap tabular-nums">{dateTime(row.lastActionAt)}</td>
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
                noun="groups"
              />
            </div>
          </>
        )}
      </section>

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${config.noun}?`}
        message={deleting ? `Delete "${deleting.name}"? This cannot be undone.` : ""}
        busy={busy}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          setBusy(true);
          try {
            await config.api.remove(deleting.id);
            toast.success(`"${deleting.name}" deleted.`);
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
