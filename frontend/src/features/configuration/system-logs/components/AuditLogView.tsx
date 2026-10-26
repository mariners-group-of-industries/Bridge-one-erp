"use client";

import { Eye, RotateCcw, ScrollText } from "lucide-react";
import { useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useResource } from "@/hooks/use-resource";
import { cn } from "@/lib/cn";
import { entityMasterDataBreadcrumbs } from "@/features/configuration/entity-master-data/breadcrumbs";
import { EmptyBlock, Field, FormGrid, Input, Notice, Select } from "@/features/configuration/entity-master-data/employee/components/kit";
import { systemLogsPaths } from "../paths";
import { ACTION_LABELS, AUDIT_ACTIONS, type AuditLogList, type AuditLogRow } from "../schemas/audit-log.schema";
import { auditLogApi } from "../services/audit-log.api";

const PAGE_SIZES = [10, 25, 50, 100] as const;
const BREADCRUMBS = entityMasterDataBreadcrumbs(systemLogsPaths.auditLogs);
const HEADERS = ["SL", "Action", "Feature Name", "User", "Action Type", "Action Date"];
const EMPTY = { feature: "", userId: "", actionType: "", from: "", to: "" };
type Filters = typeof EMPTY;

const dateTime = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
const label = (action: string) => ACTION_LABELS[action as keyof typeof ACTION_LABELS] ?? action;

const TONE: Record<string, string> = {
  CREATE: "border-success/40 bg-success/10 text-success",
  UPDATE: "border-accent-line bg-accent-soft text-accent-strong dark:text-accent",
  DELETE: "border-danger/40 bg-danger/10 text-danger",
  REVOKE: "border-danger/40 bg-danger/10 text-danger",
  LOGIN_FAILED: "border-danger/40 bg-danger/10 text-danger",
  APPROVE: "border-success/40 bg-success/10 text-success",
  EXPORT: "border-warning/40 bg-warning/10 text-warning",
  IMPORT: "border-warning/40 bg-warning/10 text-warning",
};

function ActionBadge({ action }: { action: string }) {
  return <span className={cn("inline-flex rounded border px-1.5 text-xs font-medium whitespace-nowrap", TONE[action] ?? "border-line bg-control text-ink-muted")}>{label(action)}</span>;
}

export function AuditLogView() {
  const options = useResource("audit-log-options", auditLogApi.options);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(25);
  const [paging, setPaging] = useState({ page: 1, key: "" });
  const key = JSON.stringify(applied);
  const page = paging.key === key ? paging.page : 1;
  const list = useResource(`audit-logs?${key}&p=${page}&s=${pageSize}`, () => auditLogApi.list({ ...applied, actionType: applied.actionType as never, page, pageSize }));
  const [shown, setShown] = useState<AuditLogList>();
  if (list.data && list.data !== shown) setShown(list.data);
  const [viewing, setViewing] = useState<AuditLogRow | null>(null);
  const goToPage = (next: number) => setPaging({ page: next, key });

  const view = () => {
    if (filters.from && filters.to && filters.from > filters.to) {
      setFilterError("From date must be on or before To date.");
      return;
    }
    setFilterError(null);
    setApplied(filters);
    list.reload();
  };

  return (
    <PageContainer full>
      <PageHead title="Audit Logs" subtitle="Who changed what, and when: every change, export, sign-in and sign-out." breadcrumbs={BREADCRUMBS} />

      <section aria-label="Filters" className="rounded border border-line bg-surface p-4 shadow-xs">
        <FormGrid cols={4}>
          <Field label="Feature">
            {(id) => (
              <Select
                id={id}
                value={filters.feature}
                placeholder="All features"
                options={(options.data?.features ?? []).map((f) => ({ value: f, label: f }))}
                onChange={(e) => setFilters({ ...filters, feature: e.target.value })}
              />
            )}
          </Field>
          <Field label="User">
            {(id) => (
              <Select
                id={id}
                value={filters.userId}
                placeholder="All users"
                options={(options.data?.users ?? []).map((u) => ({ value: u.id, label: u.name }))}
                onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
              />
            )}
          </Field>
          <Field label="Action Type">
            {(id) => (
              <Select
                id={id}
                value={filters.actionType}
                placeholder="All actions"
                options={AUDIT_ACTIONS.map((a) => ({ value: a, label: ACTION_LABELS[a] }))}
                onChange={(e) => setFilters({ ...filters, actionType: e.target.value })}
              />
            )}
          </Field>
          <div className="hidden lg:block" />
          <Field label="From Date">{(id) => <Input id={id} type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />}</Field>
          <Field label="To Date">{(id) => <Input id={id} type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />}</Field>
          <div className="flex items-end gap-2">
            <Button variant="accent" onClick={view}>
              <Eye /> View
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setFilters(EMPTY);
                setApplied(EMPTY);
                setFilterError(null);
              }}
            >
              <RotateCcw /> Reset
            </Button>
          </div>
        </FormGrid>
        {filterError && (
          <div className="mt-3">
            <Notice tone="error">{filterError}</Notice>
          </div>
        )}
      </section>

      <section aria-label="Audit log" className="rounded border border-line bg-surface shadow-xs">
        {list.error ? (
          <ErrorState message={list.error.message} onRetry={list.reload} />
        ) : !shown ? (
          <LoadingState label="Loading audit log…" />
        ) : shown.total === 0 ? (
          <div className="p-5">
            <EmptyBlock icon={<ScrollText />} title="No log entries">
              {key === JSON.stringify(EMPTY) ? "Actions appear here as people work in the system." : "Nothing matches these filters."}
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
                      <td className="w-16 px-1.5 py-1 text-center">
                        <Button variant="ghost" size="icon" className="hover:text-accent-strong" aria-label={`View log entry ${index + 1}`} title="View" onClick={() => setViewing(row)}>
                          <Eye />
                        </Button>
                      </td>
                      <td className="px-2.5 py-2 font-medium whitespace-nowrap">{row.feature}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap">{row.userName ?? <span className="text-ink-faint">—</span>}</td>
                      <td className="px-2.5 py-2">
                        <ActionBadge action={row.actionType} />
                      </td>
                      <td className="px-2.5 py-2 whitespace-nowrap tabular-nums">{dateTime(row.createdAt)}</td>
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
                noun="entries"
              />
            </div>
          </>
        )}
      </section>

      <Dialog open={viewing !== null} size="lg" title="Audit log entry" onClose={() => setViewing(null)} footer={<Button onClick={() => setViewing(null)}>Close</Button>}>
        {viewing && (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <Detail label="Feature Name">{viewing.feature}</Detail>
            <Detail label="Action Type">
              <ActionBadge action={viewing.actionType} />
            </Detail>
            <Detail label="User">{viewing.userName ?? "—"}</Detail>
            <Detail label="Action Date">{dateTime(viewing.createdAt)}</Detail>
            <Detail label="Request">
              <span className="font-mono text-xs">
                {viewing.method} {viewing.path}
              </span>
            </Detail>
            <Detail label="Result">HTTP {viewing.status}</Detail>
            <Detail label="Record ID">{viewing.entityId ? <span className="font-mono text-xs">{viewing.entityId}</span> : "—"}</Detail>
            <Detail label="IP Address">{viewing.ipAddress ?? "—"}</Detail>
            <div className="sm:col-span-2">
              <Detail label="Device / Browser">{viewing.userAgent ?? "—"}</Detail>
            </div>
          </dl>
        )}
      </Dialog>
    </PageContainer>
  );
}

function Detail({ label: title, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold tracking-wider text-ink-faint uppercase">{title}</dt>
      <dd className="text-sm break-words text-ink">{children}</dd>
    </div>
  );
}
