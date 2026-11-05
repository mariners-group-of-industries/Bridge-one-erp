"use client";

import { Copy, Pencil, Plus, Power, Search, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Indicator } from "@/components/ui/indicator";
import { Pagination } from "@/components/ui/pagination";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { PERMISSION_ADMIN_FEATURE } from "@/lib/permissions/registry";
import { entityMasterDataBreadcrumbs } from "@/features/configuration/entity-master-data/breadcrumbs";
import { CONTROL_CLASS, EmptyBlock, Select } from "@/features/configuration/entity-master-data/employee/components/kit";
import { securityPaths } from "../../paths";
import type { PermissionGroupList, PermissionGroupRow } from "../schemas/access.schema";
import { permissionGroupApi } from "../services/access.api";

const PAGE_SIZES = [10, 25, 50, 100] as const;
const dateTime = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
const STATUS_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
];

/** Settings › Access Control › Permission Groups. */
export function PermissionGroupListView() {
  const toast = useToast();
  const router = useRouter();
  const { can } = useSession();
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [pageSize, setPageSize] = useState<number>(25);
  const [paging, setPaging] = useState({ page: 1, key: "" });
  const key = `${search}|${status}`;
  const page = paging.key === key ? paging.page : 1;
  const list = useResource(`permission-groups?${key}&p=${page}&s=${pageSize}`, () => permissionGroupApi.list({ search, status, page, pageSize }));
  const [shown, setShown] = useState<PermissionGroupList>();
  if (list.data && list.data !== shown) setShown(list.data);
  const [deleting, setDeleting] = useState<PermissionGroupRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const goToPage = (next: number) => setPaging({ page: next, key });
  const mayCreate = can(PERMISSION_ADMIN_FEATURE, "create");
  const mayEdit = can(PERMISSION_ADMIN_FEATURE, "edit");
  const mayDelete = can(PERMISSION_ADMIN_FEATURE, "delete");

  async function run(id: string, action: () => Promise<unknown>, done: string) {
    setBusy(id);
    try {
      await action();
      toast.success(done);
      list.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  /** Activate / deactivate keeps everything else of the group. */
  const toggleStatus = (row: PermissionGroupRow) =>
    run(
      row.id,
      async () => {
        const group = await permissionGroupApi.get(row.id);
        await permissionGroupApi.update(row.id, { name: group.name, code: group.code, description: group.description ?? "", status: group.status === "ACTIVE" ? "INACTIVE" : "ACTIVE", grants: group.grants });
      },
      row.status === "ACTIVE" ? `"${row.name}" deactivated: its users lose its permissions.` : `"${row.name}" activated.`,
    );

  return (
    <PageContainer full>
      <PageHead
        title="Permission Groups"
        subtitle="Reusable sets of permissions. A user's access is the combination of their active groups, adjusted by individual Allow / Deny."
        breadcrumbs={entityMasterDataBreadcrumbs(securityPaths.permissionGroup)}
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
                  placeholder="Name, code or description… (Enter)"
                  onChange={(event) => {
                    setSearchText(event.target.value);
                    if (event.target.value === "") setSearch("");
                  }}
                  className={cn(CONTROL_CLASS, "pl-8")}
                />
              </label>
            </form>
            <Select aria-label="Status" className="w-36" value={status} placeholder={false} options={STATUS_OPTIONS} onChange={(e) => setStatus(e.target.value)} />
            {mayCreate && (
              <Link href={securityPaths.permissionGroupNew} className={buttonClasses("accent", "md")}>
                <Plus /> Add Permission Group
              </Link>
            )}
          </>
        }
      />

      <section className="rounded border border-line bg-surface shadow-xs">
        {list.error ? (
          <ErrorState message={list.error.message} onRetry={list.reload} />
        ) : !shown ? (
          <LoadingState label="Loading permission groups…" />
        ) : shown.total === 0 ? (
          <div className="p-5">
            <EmptyBlock icon={<ShieldCheck />} title={search || status !== "ALL" ? "No matching groups" : "No permission groups yet"}>
              {search || status !== "ALL"
                ? "Try a different search or status."
                : mayCreate && (
                    <Link href={securityPaths.permissionGroupNew} className={buttonClasses("accent", "sm", "mt-3")}>
                      <Plus /> Add Permission Group
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
                    {["SL", "Action", "Group Name", "Code", "Status", "Permissions", "Users", "Created By", "Created At", "Updated At"].map((h) => (
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
                      <td className="px-1.5 py-1">
                        <div className="flex items-center gap-1">
                          <Link href={securityPaths.permissionGroupEdit(row.id)} title={mayEdit ? "Edit" : "View"} aria-label={`${mayEdit ? "Edit" : "View"} ${row.name}`} className={cn(buttonClasses("ghost", "icon"), "hover:bg-accent-soft hover:text-accent-strong")}>
                            <Pencil aria-hidden="true" />
                          </Link>
                          {mayCreate && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Duplicate ${row.name}`}
                              title="Duplicate"
                              disabled={busy === row.id}
                              onClick={() =>
                                run(
                                  row.id,
                                  async () => router.push(securityPaths.permissionGroupEdit((await permissionGroupApi.duplicate(row.id)).id)),
                                  `Copied "${row.name}" (inactive until you activate it).`,
                                )
                              }
                            >
                              <Copy />
                            </Button>
                          )}
                          {mayEdit && (
                            <Button variant="ghost" size="icon" aria-label={`${row.status === "ACTIVE" ? "Deactivate" : "Activate"} ${row.name}`} title={row.status === "ACTIVE" ? "Deactivate" : "Activate"} disabled={busy === row.id} onClick={() => toggleStatus(row)}>
                              <Power />
                            </Button>
                          )}
                          {mayDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="hover:text-danger"
                              aria-label={`Delete ${row.name}`}
                              title={row.userCount > 0 ? "Assigned to users: remove them or deactivate instead" : "Delete"}
                              disabled={row.userCount > 0 || busy === row.id}
                              onClick={() => setDeleting(row)}
                            >
                              <Trash2 />
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="px-2.5 py-2 whitespace-nowrap">
                        <Link href={securityPaths.permissionGroupEdit(row.id)} className="font-medium text-accent-strong hover:underline dark:text-accent">
                          {row.name}
                        </Link>
                        {row.description && <p className="max-w-80 truncate text-xs text-ink-faint">{row.description}</p>}
                      </td>
                      <td className="px-2.5 py-2 font-mono text-xs whitespace-nowrap">{row.code}</td>
                      <td className="px-2.5 py-2">
                        <Indicator color={row.status === "ACTIVE" ? "green" : "gray"}>{row.status === "ACTIVE" ? "Active" : "Inactive"}</Indicator>
                        {row.fullAccess && (
                          <Indicator color="orange" className="ml-1">
                            Full access
                          </Indicator>
                        )}
                      </td>
                      <td className="px-2.5 py-2 text-right tabular-nums">{row.permissionCount}</td>
                      <td className="px-2.5 py-2 text-right tabular-nums">{row.userCount}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap">{row.createdBy ?? <span className="text-ink-faint">—</span>}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap tabular-nums">{dateTime(row.createdAt)}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap tabular-nums">{dateTime(row.updatedAt)}</td>
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
        title="Delete permission group?"
        message={deleting ? `Delete "${deleting.name}" (${deleting.code})? This cannot be undone.` : ""}
        busy={busy === deleting?.id}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          const target = deleting;
          await run(target.id, () => permissionGroupApi.remove(target.id), `"${target.name}" deleted.`);
          setDeleting(null);
        }}
      />
    </PageContainer>
  );
}
