"use client";

import { ArrowLeft, Ban, Check, FileCheck2, RefreshCw, Save, Search, Send, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { apiRequest, errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { resolveBreadcrumbs } from "@/lib/navigation/registry";
import { Checkbox, EmptyBlock, Field, FormGrid, Input, Panel, ReadValue, TextArea } from "@/features/configuration/entity-master-data/employee/components/kit";
import { hrmPaths } from "../../paths";
import { formatDate, monthLabel } from "../../shared/hr-ui";
import type { LineSort, PayrollBatchDetail, PayrollLine, PayrollLineDetail, PayrollLinePage } from "../batch-types";
import { ActionDialog, Callout, PayrollStatusBadge, PayrollSummary, SalaryDetailDialog, SalaryTable, bdt } from "./payroll-ui";

type Action = "recalculate" | "submit" | "approve" | "reject" | "cancel" | "publish";
const PAGE_SIZES = [25, 50, 100] as const;
const dateTime = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const ACTIONS: Record<Action, { title: string; confirm: string; done: string; remarks?: "required" | "optional"; remarksLabel?: string; danger?: boolean }> = {
  recalculate: { title: "Recalculate payroll", confirm: "Recalculate", done: "Payroll recalculated." },
  submit: { title: "Submit for approval", confirm: "Submit for Approval", done: "Payroll submitted for approval." },
  approve: { title: "Approve payroll", confirm: "Approve", done: "Approval recorded.", remarks: "optional", remarksLabel: "Remarks" },
  reject: { title: "Reject payroll", confirm: "Reject", done: "Payroll rejected.", remarks: "required", remarksLabel: "Reason for rejection", danger: true },
  cancel: { title: "Cancel payroll", confirm: "Cancel Payroll", done: "Payroll cancelled.", remarks: "required", remarksLabel: "Reason for cancelling", danger: true },
  publish: { title: "Publish payslips", confirm: "Publish Payslips", done: "Payslips published; employees can now see them in Employee Self Service." },
};

const STAGE_VARIANT: Record<string, "success" | "danger" | "warning" | "neutral"> = { APPROVED: "success", REJECTED: "danger", PENDING: "warning", SKIPPED: "neutral" };

export function PayrollBatchView({ id }: { id: string }) {
  const toast = useToast();
  const batch = useResource(`hrm-payroll-batch:${id}`, () => apiRequest<PayrollBatchDetail>(`/api/hrm/payroll/batches/${id}`), { refreshOnFocus: true });
  const b = batch.data;

  // ── Employee salaries (server-side search, sort and pages) ──
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [issues, setIssues] = useState(false);
  const [sort, setSort] = useState<{ by: LineSort; dir: "asc" | "desc" }>({ by: "sl", dir: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchText.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);
  const query = new URLSearchParams({ sort: sort.by, dir: sort.dir, page: String(page), pageSize: String(pageSize) });
  if (search) query.set("search", search);
  if (issues) query.set("issues", "1");
  // The batch version is part of the key, so the lines reload after a recalculation.
  const lines = useResource(b ? `hrm-payroll-lines:${id}:${b.version}?${query}` : null, () => apiRequest<PayrollLinePage>(`/api/hrm/payroll/batches/${id}/lines?${query}`));
  const [shown, setShown] = useState<PayrollLinePage | null>(null);
  if (lines.data && lines.data !== shown) setShown(lines.data);
  const linePage = lines.data ?? shown;

  // ── Employee salary details ──
  const [openLine, setOpenLine] = useState<PayrollLine | null>(null);
  const detail = useResource(openLine?.id ? `hrm-payroll-line:${openLine.id}:${b?.version}` : null, () => apiRequest<PayrollLineDetail>(`/api/hrm/payroll/batches/${id}/lines/${openLine!.id}`));

  // ── Header edit (Draft / Rejected) ──
  const [edit, setEdit] = useState<{ payrollDate: string; description: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Workflow actions ──
  const [action, setAction] = useState<Action | null>(null);
  const [remarks, setRemarks] = useState("");
  const [remarksError, setRemarksError] = useState("");
  const [busy, setBusy] = useState(false);

  function open(next: Action) {
    setRemarks("");
    setRemarksError("");
    setAction(next);
  }

  async function run() {
    if (!action || !b) return;
    const spec = ACTIONS[action];
    if (spec.remarks === "required" && !remarks.trim()) {
      setRemarksError(`${spec.remarksLabel} is required.`);
      return;
    }
    setBusy(true);
    try {
      const body =
        action === "approve" || action === "reject" ? { decision: action, remarks: remarks.trim(), version: b.version } : action === "cancel" ? { reason: remarks.trim(), version: b.version } : { version: b.version };
      const path = action === "approve" || action === "reject" ? "decision" : action;
      const result = await apiRequest<{ status: string; final: boolean } | undefined>(`/api/hrm/payroll/batches/${id}/${path}`, { method: "POST", body: JSON.stringify(body) });
      toast.success(action === "approve" ? (result?.final ? "Payroll approved." : "Stage approved; the payroll moves to the next approval stage.") : spec.done);
      setAction(null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
      batch.reload();
    }
  }

  async function saveHeader() {
    if (!edit || !b) return;
    if (!edit.payrollDate) return toast.error("Select the payroll date.");
    setSaving(true);
    try {
      await apiRequest(`/api/hrm/payroll/batches/${id}`, { method: "PATCH", body: JSON.stringify({ ...edit, version: b.version }) });
      toast.success("Payroll details saved.");
      setEdit(null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
      batch.reload();
    }
  }

  const crumbs = resolveBreadcrumbs(hrmPaths.payrollBatch(id)).slice(1);
  const back = (
    <Link href={hrmPaths.payroll} className={buttonClasses("secondary", "md")}>
      <ArrowLeft aria-hidden="true" />
      Back
    </Link>
  );

  if (!b) {
    return (
      <PageContainer full>
        <PageHead title="Payroll" breadcrumbs={crumbs} actions={back} />
        <section className="rounded border border-line bg-surface p-4 shadow-xs">{batch.error ? <ErrorState message={batch.error.message} onRetry={batch.reload} /> : <LoadingState label="Loading payroll…" />}</section>
      </PageContainer>
    );
  }

  const period = monthLabel(b.month);
  const spec = action ? ACTIONS[action] : null;
  const actionText: Record<Action, ReactNode> = {
    recalculate: `Calculate ${b.reference} again from the current salary, calendar, attendance and policy data? The saved figures are replaced.`,
    submit: (
      <>
        Submit {b.reference} for approval: {b.totals.employees} employees, net payable BDT {bdt(b.totals.net)}
        {b.warningCount > 0 ? `, with ${b.warningCount} remark(s)` : ""}? The figures are locked while it is under processing, and it is approved only after the last approval stage.
      </>
    ),
    approve: b.approval.current
      ? `Approve stage ${b.approval.current.stageNo} of ${b.approval.stages} (${b.approval.current.name}) of ${b.reference}, net payable BDT ${bdt(b.totals.net)}?${b.approval.current.stageNo < b.approval.stages ? " It then waits for the next stage." : " This is the final approval."}`
      : `Approve ${b.reference}, net payable BDT ${bdt(b.totals.net)}?`,
    reject: `Reject ${b.reference}? It returns to HR for correction and must be submitted again.`,
    cancel: `Cancel ${b.reference}? It is kept for audit, and a new payroll can then be generated for ${b.officeName}, ${period}.`,
    publish: `Publish the payslips of ${b.reference} (${b.totals.employees} employees, ${period})? Each employee can then see their own payslip in Employee Self Service and is notified. Publishing cannot be undone.`,
  };

  return (
    <PageContainer full>
      <PageHead
        title={`Payroll ${b.reference}`}
        indicator={<PayrollStatusBadge status={b.status} />}
        subtitle={`${b.officeName} (${b.businessUnit}) · ${period} · ${b.salaryType}`}
        breadcrumbs={crumbs}
        actions={
          <>
            {back}
            {b.can.edit && (
              <Button onClick={() => open("recalculate")}>
                <RefreshCw aria-hidden="true" />
                Recalculate
              </Button>
            )}
            {b.can.cancel && (
              <Button onClick={() => open("cancel")}>
                <Ban aria-hidden="true" />
                Cancel Payroll
              </Button>
            )}
            {b.can.edit && (
              <Button variant="primary" disabled={!b.can.submit} title={b.stale ? "Recalculate first: the source data changed" : b.errorCount > 0 ? "Fix the errors first" : undefined} onClick={() => open("submit")}>
                <Send aria-hidden="true" />
                {b.status === "Rejected" ? "Resubmit for Approval" : "Submit for Approval"}
              </Button>
            )}
            {b.can.publish && (
              <Button variant="primary" onClick={() => open("publish")}>
                <FileCheck2 aria-hidden="true" />
                Publish Payslips
              </Button>
            )}
            {b.status === "Approved" && b.payslipsPublishedAt && (
              <Badge variant="success" title={`Published ${dateTime(b.payslipsPublishedAt)}${b.payslipsPublishedByName ? ` by ${b.payslipsPublishedByName}` : ""}`}>
                Payslips published
              </Badge>
            )}
            {b.can.decide && (
              <>
                <Button variant="danger" onClick={() => open("reject")}>
                  <X aria-hidden="true" />
                  Reject
                </Button>
                <Button variant="primary" onClick={() => open("approve")}>
                  <Check aria-hidden="true" />
                  Approve
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-3">
        {b.status === "Rejected" && (
          <Callout tone="danger" title={`Rejected${b.decidedByName ? ` by ${b.decidedByName}` : ""}`}>
            {b.rejectionReason} Correct the source data, recalculate, and submit again.
          </Callout>
        )}
        {b.status === "Cancelled" && (
          <Callout tone="info" title="Cancelled">
            {b.cancelReason}
          </Callout>
        )}
        {b.status === "Under Processing" && (
          <Callout tone="info" title={b.approval.current ? `Waiting at approval stage ${b.approval.current.stageNo} of ${b.approval.stages}: ${b.approval.current.name}` : "Waiting for approval"}>
            Submitted by {b.submittedByName ?? "HR"}
            {b.submittedAt ? ` on ${dateTime(b.submittedAt)}` : ""}. The figures are locked.
          </Callout>
        )}
        {b.stale && (
          <Callout
            tone="warning"
            title="Salary, attendance or policy data changed after this payroll was calculated"
            action={
              b.can.edit && (
                <Button size="sm" onClick={() => open("recalculate")}>
                  <RefreshCw aria-hidden="true" />
                  Recalculate
                </Button>
              )
            }
          >
            The figures below are still the ones calculated on {dateTime(b.calculatedAt)}. Recalculate before submitting.
          </Callout>
        )}
        {b.errorCount > 0 && (
          <Callout tone="danger" title={`${b.errorCount} error(s) must be fixed before this payroll can be submitted`}>
            Tick &ldquo;With remarks only&rdquo; to find the employees, fix the data, then recalculate.
          </Callout>
        )}

        <PayrollSummary totals={b.totals} status={<PayrollStatusBadge status={b.status} />} eligibleCount={b.eligibleCount} excluded={b.excluded} />

        <Panel
          title="Payroll details"
          actions={
            b.can.edit &&
            (edit ? (
              <>
                <Button size="sm" onClick={() => setEdit(null)} disabled={saving}>
                  Discard
                </Button>
                <Button size="sm" variant="primary" loading={saving} onClick={() => void saveHeader()}>
                  <Save aria-hidden="true" />
                  Save
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setEdit({ payrollDate: b.payrollDate, description: b.description ?? "" })}>
                Edit
              </Button>
            ))
          }
        >
          <FormGrid cols={4}>
            <ReadValue label="Branch Name" value={b.businessUnit} />
            <ReadValue label="Office" value={b.officeName} />
            <ReadValue label="Salary Type" value={b.salaryType} />
            <ReadValue label="Payroll Period" value={`${period} (${formatDate(b.fromDate)} – ${formatDate(b.toDate)})`} />
            {edit ? (
              <>
                <Field label="Payroll Date" required>
                  {(fid) => <Input id={fid} type="date" value={edit.payrollDate} onChange={(e) => setEdit({ ...edit, payrollDate: e.target.value })} />}
                </Field>
                <Field label="Description" span={3}>
                  {(fid) => <TextArea id={fid} rows={2} maxLength={500} className="min-h-14" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />}
                </Field>
              </>
            ) : (
              <>
                <ReadValue label="Payroll Date" value={formatDate(b.payrollDate)} />
                <ReadValue label="Description" value={b.description || "—"} className="sm:col-span-2" />
                <ReadValue label="Generated" value={`${b.createdByName ?? "—"} · ${dateTime(b.createdAt)}`} />
              </>
            )}
          </FormGrid>
        </Panel>

        <section className="flex flex-col gap-3 rounded border border-line bg-surface p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-ink">
              Employee salaries
              <span className="ml-2 text-xs font-normal text-ink-muted">calculated {dateTime(b.calculatedAt)}</span>
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              {b.warningCount + b.errorCount > 0 && (
                <Checkbox
                  label={`With remarks only (${b.warningCount + b.errorCount})`}
                  checked={issues}
                  onChange={(e) => {
                    setIssues(e.target.checked);
                    setPage(1);
                  }}
                />
              )}
              <div className="relative w-64 max-w-full">
                <label htmlFor="batch-salary-search" className="sr-only">
                  Search employees by name or code
                </label>
                <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-faint" />
                <Input id="batch-salary-search" type="search" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Employee name or code" className="pl-8" autoComplete="off" />
              </div>
            </div>
          </div>
          {lines.error && !linePage ? (
            <ErrorState message={lines.error.message} onRetry={lines.reload} />
          ) : !linePage ? (
            <LoadingState label="Loading salaries…" />
          ) : linePage.rows.length === 0 ? (
            <EmptyBlock icon={search || issues ? <Search /> : <Users />} title={search || issues ? "No employee matches" : "This payroll has no employees"} />
          ) : (
            <>
              <SalaryTable rows={linePage.rows} loading={lines.loading} sort={sort.by} dir={sort.dir} onSort={(by) => setSort((s) => ({ by, dir: s.by === by && s.dir === "asc" ? "desc" : "asc" }))} onOpen={setOpenLine} />
              <Pagination
                page={linePage.page}
                pageSize={linePage.pageSize}
                totalRecords={linePage.total}
                totalPages={Math.max(1, Math.ceil(linePage.total / linePage.pageSize))}
                pageSizes={PAGE_SIZES}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
                disabled={lines.loading}
                noun="employees"
              />
            </>
          )}
        </section>

        <div className="grid gap-3 lg:grid-cols-2">
          <Panel title="Approval progress" description="Stages of the Salary Sheet pipeline (Configuration › Approval Setup).">
            {b.stages.length === 0 ? (
              <p className="text-[13px] text-ink-muted">
                {b.status === "Draft" || b.status === "Cancelled"
                  ? "Not submitted yet."
                  : b.status === "Approved"
                    ? "Single-level approval: no pipeline stages applied to this payroll."
                    : "The approval stages are listed once the first approver acts. Without a Salary Sheet pipeline, anyone with the Approve permission on Payroll approves in one step."}
              </p>
            ) : (
              <ol className="flex flex-col gap-2">
                {b.stages.map((s) => (
                  <li key={s.stageNo} className="rounded border border-line px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-ink">
                        Stage {s.stageNo}: {s.name}
                      </span>
                      <Badge variant={STAGE_VARIANT[s.status] ?? "neutral"}>{s.status.charAt(0) + s.status.slice(1).toLowerCase()}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      Approvers: {s.approverNames.join(", ") || "anyone with the Approve permission"}
                      {s.actedBy && s.actedAt ? ` · last action by ${s.actedBy}, ${dateTime(s.actedAt)}` : ""}
                    </p>
                    {s.comment && <p className="mt-0.5 text-xs text-ink">&ldquo;{s.comment}&rdquo;</p>}
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel title="History" description="Every change to this payroll, kept for audit.">
            <ol className="flex flex-col">
              {b.events.map((e, i) => (
                <li key={e.id} className={cn("grid grid-cols-[auto_1fr] gap-x-3 pb-3", i === b.events.length - 1 && "pb-0")}>
                  <span aria-hidden="true" className="flex flex-col items-center">
                    <span className={cn("mt-1 size-2 rounded-full", e.action === "Rejected" || e.action === "Cancelled" ? "bg-danger" : e.action === "Approved" ? "bg-success" : "bg-accent")} />
                    {i < b.events.length - 1 && <span className="mt-1 w-px flex-1 bg-line" />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] text-ink">
                      <span className="font-semibold">{e.action}</span>
                      {e.stageNo ? ` · stage ${e.stageNo}${e.stageName ? ` (${e.stageName})` : ""}` : ""}
                      {e.fromStatus && e.fromStatus !== e.toStatus ? ` · ${e.fromStatus} → ${e.toStatus}` : ""}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {e.actorName} · {dateTime(e.createdAt)}
                    </p>
                    {e.remarks && <p className="text-xs text-ink">{e.remarks}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        {b.policies.length > 0 && (
          <Panel title="Policies used" description="HR Governance records this calculation read; a later change marks the draft as out of date.">
            <ul className="flex flex-wrap gap-1.5">
              {b.policies.map((p) => (
                <li key={p.id}>
                  <Badge title={`Last changed ${dateTime(p.updatedAt)}`}>{p.label}</Badge>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>

      <SalaryDetailDialog open={openLine !== null} month={b.month} line={detail.data ?? null} loading={detail.loading} error={detail.error?.message ?? null} onClose={() => setOpenLine(null)} />

      <ActionDialog open={action !== null} title={spec?.title ?? ""} confirmLabel={spec?.confirm ?? ""} variant={spec?.danger ? "danger" : "primary"} busy={busy} onConfirm={() => void run()} onClose={() => setAction(null)}>
        {action && <p>{actionText[action]}</p>}
        {spec?.remarks && (
          <Field label={spec.remarksLabel!} required={spec.remarks === "required"} error={remarksError || undefined}>
            {(fid) => (
              <TextArea
                id={fid}
                rows={3}
                maxLength={500}
                value={remarks}
                aria-invalid={!!remarksError}
                onChange={(e) => {
                  setRemarks(e.target.value);
                  setRemarksError("");
                }}
              />
            )}
          </Field>
        )}
      </ActionDialog>
    </PageContainer>
  );
}
