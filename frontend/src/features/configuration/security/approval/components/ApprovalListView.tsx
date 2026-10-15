"use client";

import { Eye, Pencil, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { entityMasterDataBreadcrumbs } from "@/features/configuration/entity-master-data/breadcrumbs";
import { CONTROL_CLASS, EmptyBlock, TABLE } from "@/features/configuration/entity-master-data/employee/components/kit";
import { securityPaths } from "../../paths";
import { APPROVAL_ORDERS, AUTHORIZATION_TYPES, labelOf, USER_TYPES, type PipelineList, type PipelineRow } from "../schemas/approval.schema";
import { approvalApi } from "../services/approval.api";

const PAGE_SIZES = [10, 25, 50, 100] as const;
const BREADCRUMBS = entityMasterDataBreadcrumbs(securityPaths.approvalSetup);
const HEADERS = ["SL", "Action", "Pipeline Name", "Super Approver", "Feature Name"];

export function ApprovalListView() {
  const toast = useToast();
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState<number>(25);
  const [paging, setPaging] = useState({ page: 1, search: "" });
  const page = paging.search === search ? paging.page : 1;
  const list = useResource(`approval-pipelines?${search}&p=${page}&s=${pageSize}`, () => approvalApi.list({ search, page, pageSize }));
  const [shown, setShown] = useState<PipelineList>();
  if (list.data && list.data !== shown) setShown(list.data);
  const [viewing, setViewing] = useState<PipelineRow | null>(null);
  const [deleting, setDeleting] = useState<PipelineRow | null>(null);
  const [busy, setBusy] = useState(false);
  const goToPage = (next: number) => setPaging({ page: next, search });

  return (
    <PageContainer full>
      <PageHead
        title="Approval Setup"
        subtitle="Approval pipelines: who approves each feature, stage by stage."
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
                <span className="sr-only">Search pipelines (press Enter)</span>
                <Search aria-hidden="true" className="pointer-events-none absolute top-2 left-2.5 size-4 text-ink-faint" />
                <input
                  type="search"
                  value={searchText}
                  maxLength={100}
                  placeholder="Pipeline, feature or approver… (Enter)"
                  onChange={(event) => {
                    setSearchText(event.target.value);
                    if (event.target.value === "") setSearch("");
                  }}
                  className={cn(CONTROL_CLASS, "pl-8")}
                />
              </label>
            </form>
            <Link href={securityPaths.approvalNew} className={buttonClasses("accent", "md")}>
              <Plus /> Add Approval Setup
            </Link>
          </>
        }
      />

      <section className="rounded border border-line bg-surface shadow-xs">
        {list.error ? (
          <ErrorState message={list.error.message} onRetry={list.reload} />
        ) : !shown ? (
          <LoadingState label="Loading approval pipelines…" />
        ) : shown.total === 0 ? (
          <div className="p-5">
            <EmptyBlock icon={<ShieldCheck />} title={search ? "No matching pipelines" : "No approval pipelines yet"}>
              {search ? (
                "Try a different search."
              ) : (
                <Link href={securityPaths.approvalNew} className={buttonClasses("accent", "sm", "mt-3")}>
                  <Plus /> Add Approval Setup
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
                      <td className="w-32 px-1.5 py-1">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="icon" className="hover:text-accent-strong" aria-label={`View ${row.name}`} title="View" onClick={() => setViewing(row)}>
                            <Eye />
                          </Button>
                          <Link
                            href={securityPaths.approvalEdit(row.id)}
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
                      <td className="px-2.5 py-2 font-medium whitespace-nowrap">{row.name}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap">{row.superApproverName ?? <span className="text-ink-faint">—</span>}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap">{row.feature}</td>
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
                noun="pipelines"
              />
            </div>
          </>
        )}
      </section>

      <PipelineViewDialog row={viewing} onClose={() => setViewing(null)} />
      <ConfirmDialog
        open={deleting !== null}
        title="Delete approval setup?"
        message={deleting ? `Delete the pipeline "${deleting.name}" and all its stages? This cannot be undone.` : ""}
        busy={busy}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          setBusy(true);
          try {
            await approvalApi.remove(deleting.id);
            toast.success(`Pipeline "${deleting.name}" deleted.`);
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

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold tracking-wider text-ink-faint uppercase">{label}</dt>
      <dd className="text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

/** Read-only popup of a pipeline and its stages. */
function PipelineViewDialog({ row, onClose }: { row: PipelineRow | null; onClose: () => void }) {
  const pipeline = useResource(row ? `approval-pipeline:${row.id}` : null, () => approvalApi.get(row!.id));
  const data = pipeline.data;
  return (
    <Dialog open={row !== null} size="xl" title={row ? `Approval Setup · ${row.name}` : ""} onClose={onClose} footer={<Button onClick={onClose}>Close</Button>}>
      {pipeline.error ? (
        <ErrorState message={pipeline.error.message} onRetry={pipeline.reload} />
      ) : !data || data.id !== row?.id ? (
        <LoadingState />
      ) : (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-1 gap-3 rounded border border-line bg-canvas px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Pipeline Name">{data.name}</Detail>
            <Detail label="Approval Feature">{data.feature}</Detail>
            <Detail label="User Type">{labelOf(USER_TYPES, data.userType)}</Detail>
            <Detail label="Super Approver">{data.superApproverName ?? "—"}</Detail>
            <Detail label="Remarks">{data.remarks || "N/A"}</Detail>
          </dl>
          {data.stages.map((stage) => (
            <section key={stage.id} aria-label={`Stage ${stage.stageNo}`} className="rounded border border-line">
              <h3 className="border-b border-line bg-canvas px-4 py-2 text-sm font-semibold text-ink">Stage {stage.stageNo}</h3>
              <dl className="grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-3">
                <Detail label="Stage Name">{stage.name}</Detail>
                <Detail label="Approval Order">{labelOf(APPROVAL_ORDERS, stage.approvalOrder)}</Detail>
                <Detail label="Number of Person">{stage.requiredCount}</Detail>
              </dl>
              <div className={cn(TABLE.wrap, "mx-4 mb-4")}>
                <table className={TABLE.table}>
                  <thead className={TABLE.head}>
                    <tr>
                      {["SL", "User Type", "Approver Name", "Authorization Type"].map((h) => (
                        <th key={h} scope="col" className={TABLE.th}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stage.approvers.map((a, index) => (
                      <tr key={a.id} className={TABLE.row}>
                        <td className={`${TABLE.td} w-12 text-right tabular-nums`}>{index + 1}</td>
                        <td className={TABLE.td}>{labelOf(USER_TYPES, a.userType)}</td>
                        <td className={`${TABLE.td} font-medium`}>{a.approverName}</td>
                        <td className={TABLE.td}>{labelOf(AUTHORIZATION_TYPES, a.authorizationType)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </Dialog>
  );
}
