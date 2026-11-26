"use client";

import { ArrowLeft, CalendarPlus, CheckCircle2, Eye, FileText, Paperclip, RotateCcw, Send, XCircle } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { ApiClientError, errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { CONTROL_CLASS, EmptyBlock, Field, FormGrid, Input, Notice, Panel, ReadValue, Select, TABLE, TextArea } from "@/features/configuration/entity-master-data/employee/components/kit";
import { MAX_LEAVE_ATTACHMENTS } from "@/features/hrm/self-service/leave-movement/schemas/leave-movement.schema";
import { essApi } from "../api";
import { essPaths } from "../navigation";
import type { EssEmployee, EssLeaveApplication } from "../types";
import { EssPage, RequestStatusBadge, StatTile, fmtDate, fmtDateTime, localToday, usePaged } from "./ess-ui";

const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";
const thisYear = () => Number(localToday().slice(0, 4));

// ─── Leave Balance ────────────────────────────────────────────────────────────

export function LeaveBalanceView() {
  return (
    <EssPage
      title="Leave Balance"
      subtitle="Entitlements come from your leave policy in HR. Pending applications are already held back from what remains."
      actions={
        <Link href={essPaths.leaveApply} className={buttonClasses("primary", "md")}>
          <CalendarPlus aria-hidden="true" />
          Apply for Leave
        </Link>
      }
    >
      {() => <Balance />}
    </EssPage>
  );
}

function YearSelect({ value, onChange }: { value: number; onChange: (year: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="ess-leave-year" className="text-xs font-medium text-ink-muted">
        Year
      </label>
      <select id="ess-leave-year" value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-8 rounded border border-line-strong bg-surface px-2 text-[12px] text-ink focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none">
        {Array.from({ length: 5 }, (_, i) => thisYear() + 1 - i).map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}

function Balance() {
  const [year, setYear] = useState(thisYear());
  const data = useResource(`ess-leave:${year}`, () => essApi.leave(year));
  const d = data.data;
  return (
    <>
      {d && (
        <section aria-label="Applications this year" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Pending" value={d.counts.pending} tone="warning" href={essPaths.leaveHistory} />
          <StatTile label="Approved" value={d.counts.approved} tone="success" href={essPaths.leaveHistory} />
          <StatTile label="Rejected" value={d.counts.rejected} tone="danger" href={essPaths.leaveHistory} />
          <StatTile label="Cancelled" value={d.counts.cancelled} href={essPaths.leaveHistory} />
        </section>
      )}
      <Panel title={`Balances ${year}`} actions={<YearSelect value={year} onChange={setYear} />} flush>
        {data.error ? (
          <ErrorState message={data.error.message} onRetry={data.reload} />
        ) : !d ? (
          <LoadingState label="Loading balances…" />
        ) : d.balances.length === 0 ? (
          <div className="p-4">
            <EmptyBlock icon={<FileText />} title="No leave entitlement configured">
              No leave type is set up for you. Ask HR to add your leave policy.
            </EmptyBlock>
          </div>
        ) : (
          <div className={cn(TABLE.wrap, "rounded-none border-0")}>
            <table className={TABLE.table}>
              <thead className={TABLE.head}>
                <tr>
                  {["Leave Type", "Entitlement", "Carried Forward", "Taken", "Pending", "Available", "Rules"].map((h) => (
                    <th key={h} scope="col" className={TABLE.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.balances.map((b) => (
                  <tr key={b.leaveType} className={TABLE.row}>
                    <td className={cn(TABLE.td, "font-medium")}>{b.leaveType}</td>
                    <td className={cn(TABLE.td, "tabular-nums")}>{b.quota ?? "Not limited"}</td>
                    <td className={cn(TABLE.td, "tabular-nums")}>{b.carried || "—"}</td>
                    <td className={cn(TABLE.td, "tabular-nums")}>{b.taken}</td>
                    <td className={cn(TABLE.td, "tabular-nums", b.pending > 0 && "text-warning")}>{b.pending}</td>
                    <td className={cn(TABLE.td, "font-semibold tabular-nums", b.remaining !== null && b.remaining <= 0 && "text-danger")}>{b.remaining ?? "—"}</td>
                    <td className={cn(TABLE.td, "text-[11px] text-ink-muted")}>
                      {[b.noticeDays ? `Apply ${b.noticeDays}d ahead` : null, b.attachmentAfterDays !== null && b.attachmentAfterDays !== undefined ? (b.attachmentAfterDays === 0 ? "Attachment required" : `Attachment over ${b.attachmentAfterDays}d`) : null].filter(Boolean).join(" · ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

// ─── Apply ────────────────────────────────────────────────────────────────────

const EMPTY = { leaveType: "", fromDate: "", toDate: "", reason: "", contact: "" };

export function LeaveApplyView() {
  return <EssPage title="Apply for Leave" subtitle="Your application goes to the approvers set up by HR. It is not approved until the last approver approves it.">{(employee) => <Apply employee={employee} />}</EssPage>;
}

function Apply({ employee }: { employee: EssEmployee }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState<File[]>([]);
  const [fileKey, setFileKey] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ reference: string; days: number } | null>(null);
  const overview = useResource(`ess-leave:${thisYear()}`, () => essApi.leave());
  const set = (key: keyof typeof EMPTY) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const ready = !!form.leaveType && !!form.fromDate && !!form.toDate && form.toDate >= form.fromDate;
  const preview = useResource(ready ? `ess-leave-preview:${form.leaveType}:${form.fromDate}:${form.toDate}` : null, () => essApi.previewLeave({ leaveType: form.leaveType, fromDate: form.fromDate, toDate: form.toDate }));
  const p = ready ? preview.data : undefined;

  function clear() {
    setForm(EMPTY);
    setFiles([]);
    setFileKey((k) => k + 1);
    setErrors({});
    setFailure("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const next: Record<string, string> = {};
    if (!form.leaveType) next.leaveType = "Select a leave type.";
    if (!form.fromDate) next.fromDate = "Choose the first day.";
    if (!form.toDate) next.toDate = "Choose the last day.";
    else if (form.fromDate && form.toDate < form.fromDate) next.toDate = "Cannot be before From Date.";
    if (!form.reason.trim()) next.reason = "Enter a reason.";
    if (files.length > MAX_LEAVE_ATTACHMENTS) next.files = `Attach at most ${MAX_LEAVE_ATTACHMENTS} files.`;
    if (p?.attachmentRequired && files.length === 0) next.files = "This leave needs a supporting document.";
    setErrors(next);
    setFailure("");
    if (Object.values(next).some(Boolean)) return;
    setSaving(true);
    try {
      const result = await essApi.applyLeave(form, files);
      toast.success(`Leave application ${result.reference} submitted.`);
      setDone({ reference: result.reference, days: result.days });
      clear();
      overview.reload();
    } catch (error) {
      if (error instanceof ApiClientError && Object.keys(error.fieldErrors).length) setErrors(Object.fromEntries(Object.entries(error.fieldErrors).map(([k, v]) => [k, v[0]])));
      setFailure(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (!employee.canApply) return <Notice tone="error">Your employment record is inactive, so new leave applications cannot be submitted. Contact HR.</Notice>;

  const types = overview.data?.balances ?? [];
  const chosen = types.find((t) => t.leaveType === form.leaveType);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <form onSubmit={submit} noValidate className="lg:col-span-2">
        <Panel
          title="Leave Application"
          footer={
            <>
              <Button onClick={clear} disabled={saving}>
                <RotateCcw aria-hidden="true" />
                Clear
              </Button>
              <Button type="submit" variant="primary" loading={saving} disabled={!!p?.problems.length}>
                <Send aria-hidden="true" />
                Submit Application
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            {done && (
              <div role="status" className="flex flex-wrap items-center gap-2 rounded border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
                <CheckCircle2 aria-hidden="true" className="size-4" />
                <span>
                  Application <strong className="font-mono">{done.reference}</strong> ({done.days} day{done.days === 1 ? "" : "s"}) is waiting for approval.
                </span>
                <Link href={essPaths.leaveHistory} className="ml-auto font-semibold underline underline-offset-2">
                  Track it
                </Link>
              </div>
            )}
            {failure && <Notice tone="error">{failure}</Notice>}
            {overview.error && <Notice tone="error">{overview.error.message}</Notice>}
            <FormGrid cols={2}>
              <Field label="Leave Type" required error={errors.leaveType}>
                {(id) => (
                  <Select
                    id={id}
                    value={form.leaveType}
                    onChange={(e) => set("leaveType")(e.target.value)}
                    options={types.map((t) => ({ value: t.leaveType, label: t.remaining === null ? t.leaveType : `${t.leaveType} (${t.remaining} left)` }))}
                    placeholder={overview.data ? (types.length ? "Select…" : "No leave types available") : "Loading…"}
                    aria-invalid={!!errors.leaveType}
                  />
                )}
              </Field>
              <Field label="Total Leave Days" hint="Weekly offs and holidays in your calendar are not charged.">
                <div className="flex h-8 items-center gap-2 text-[13px]">
                  {!ready ? (
                    <span className="text-ink-faint">Choose the type and dates</span>
                  ) : preview.loading && !p ? (
                    <span className="text-ink-faint">Calculating…</span>
                  ) : preview.error ? (
                    <span className="text-danger">{preview.error.message}</span>
                  ) : p ? (
                    <>
                      <span className="text-lg font-bold text-ink tabular-nums">{p.days}</span>
                      <span className="text-ink-muted">
                        of {p.calendarDays} calendar day{p.calendarDays === 1 ? "" : "s"}
                      </span>
                    </>
                  ) : null}
                </div>
              </Field>
              <Field label="From Date" required error={errors.fromDate}>
                {(id) => <DateInput className={CONTROL_CLASS} id={id} value={form.fromDate} onChange={set("fromDate")} aria-invalid={!!errors.fromDate} />}
              </Field>
              <Field label="To Date" required error={errors.toDate}>
                {(id) => <DateInput className={CONTROL_CLASS} id={id} value={form.toDate} onChange={set("toDate")} aria-invalid={!!errors.toDate} />}
              </Field>
              <Field label="Reason" required span="full" error={errors.reason}>
                {(id) => <TextArea id={id} rows={3} maxLength={500} value={form.reason} onChange={(e) => set("reason")(e.target.value)} aria-invalid={!!errors.reason} />}
              </Field>
              <Field label="Contact During Leave" hint="Phone or address where you can be reached.">
                {(id) => <Input id={id} maxLength={150} value={form.contact} onChange={(e) => set("contact")(e.target.value)} />}
              </Field>
              <Field label={p?.attachmentRequired ? "Attachment" : "Attachment (optional)"} required={!!p?.attachmentRequired} error={errors.files} hint={`PDF or image, up to ${MAX_LEAVE_ATTACHMENTS} files.`}>
                {(id) => (
                  <Input
                    key={fileKey}
                    id={id}
                    type="file"
                    multiple
                    accept={ACCEPT}
                    className="h-auto py-1 file:mr-2 file:rounded file:border-0 file:bg-control file:px-2 file:py-1 file:text-xs file:font-semibold file:text-ink"
                    onChange={(e) => {
                      setFiles(Array.from(e.target.files ?? []));
                      setErrors((x) => ({ ...x, files: "" }));
                    }}
                    aria-invalid={!!errors.files}
                  />
                )}
              </Field>
            </FormGrid>
            {files.length > 0 && (
              <ul className="flex flex-wrap gap-2 text-xs text-ink-muted">
                {files.map((f) => (
                  <li key={f.name} className="flex items-center gap-1 rounded border border-line px-2 py-1">
                    <Paperclip aria-hidden="true" className="size-3" />
                    {f.name}
                  </li>
                ))}
              </ul>
            )}
            {p && p.problems.length > 0 && (
              <div role="alert" className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                <p className="font-medium">This application cannot be submitted yet:</p>
                <ul className="mt-1 list-disc pl-5">
                  {p.problems.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Panel>
      </form>

      <div className="flex flex-col gap-4">
        <Panel title={chosen ? chosen.leaveType : "Your Balance"}>
          {!chosen ? (
            <p className="text-sm text-ink-faint">Choose a leave type to see your balance and its rules.</p>
          ) : (
            <dl className="grid grid-cols-2 gap-3">
              <ReadValue label="Entitlement" value={chosen.quota ?? "Not limited"} />
              <ReadValue label="Available" value={chosen.remaining ?? "—"} />
              <ReadValue label="Taken" value={chosen.taken} />
              <ReadValue label="Pending" value={chosen.pending} />
              {chosen.noticeDays ? <ReadValue label="Apply in advance" value={`${chosen.noticeDays} day(s)`} className="col-span-2" /> : null}
            </dl>
          )}
        </Panel>
        {p && p.excluded.length > 0 && (
          <Panel title="Not charged">
            <ul className="flex flex-col gap-1.5 text-[13px]">
              {p.excluded.map((x) => (
                <li key={x.date} className="flex justify-between gap-2">
                  <span className="text-ink tabular-nums">{fmtDate(x.date)}</span>
                  <Badge>{x.reason}</Badge>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  );
}

// ─── History ──────────────────────────────────────────────────────────────────

export function LeaveHistoryView() {
  return (
    <EssPage
      title="My Leave Applications"
      actions={
        <Link href={essPaths.leaveApply} className={buttonClasses("primary", "md")}>
          <CalendarPlus aria-hidden="true" />
          Apply for Leave
        </Link>
      }
    >
      {() => <History />}
    </EssPage>
  );
}

function useCancel(onDone: () => void) {
  const toast = useToast();
  const [target, setTarget] = useState<EssLeaveApplication | null>(null);
  const [busy, setBusy] = useState(false);
  async function confirm() {
    if (!target) return;
    setBusy(true);
    try {
      await essApi.cancelLeave(target.id);
      toast.success(`${target.reference} cancelled.`);
      setTarget(null);
      onDone();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  const dialog = (
    <ConfirmDialog
      open={target !== null}
      title="Cancel leave application"
      message={target ? `Cancel ${target.reference} (${target.leaveType}, ${fmtDate(target.fromDate)} – ${fmtDate(target.toDate)})? It is kept as Cancelled and uses no balance.` : ""}
      confirmLabel="Cancel Application"
      busy={busy}
      onConfirm={() => void confirm()}
      onClose={() => setTarget(null)}
    />
  );
  return { ask: setTarget, dialog };
}

function History() {
  const data = useResource("ess-leave-history", () => essApi.leave(), { refreshOnFocus: true });
  const [status, setStatus] = useState("ALL");
  const rows = (data.data?.applications ?? []).filter((a) => status === "ALL" || a.status === status);
  const paged = usePaged(rows, 10);
  const cancel = useCancel(data.reload);
  return (
    <Panel
      title="Applications"
      actions={
        <div className="flex items-center gap-2">
          <label htmlFor="ess-leave-status" className="text-xs font-medium text-ink-muted">
            Status
          </label>
          <select id="ess-leave-status" value={status} onChange={(e) => { setStatus(e.target.value); paged.setPage(1); }} className="h-8 rounded border border-line-strong bg-surface px-2 text-[12px] text-ink focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none">
            {["ALL", "Pending", "Approved", "Rejected", "Cancelled"].map((s) => (
              <option key={s} value={s}>
                {s === "ALL" ? "All" : s}
              </option>
            ))}
          </select>
        </div>
      }
      flush
    >
      {data.error ? (
        <ErrorState message={data.error.message} onRetry={data.reload} />
      ) : !data.data ? (
        <LoadingState label="Loading applications…" />
      ) : rows.length === 0 ? (
        <div className="p-4">
          <EmptyBlock icon={<FileText />} title={status === "ALL" ? "You have not applied for leave yet" : `No ${status.toLowerCase()} applications`} />
        </div>
      ) : (
        <>
          <div className={cn(TABLE.wrap, "rounded-none border-x-0 border-t-0")}>
            <table className={TABLE.table}>
              <thead className={TABLE.head}>
                <tr>
                  {["Reference", "Leave Type", "From", "To", "Days", "Applied On", "Status", "Approval Stage", "Action"].map((h) => (
                    <th key={h} scope="col" className={TABLE.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.rows.map((a) => (
                  <tr key={a.id} className={TABLE.row}>
                    <td className={cn(TABLE.td, "font-mono text-[11px] font-semibold")}>{a.reference}</td>
                    <td className={TABLE.td}>{a.leaveType}</td>
                    <td className={cn(TABLE.td, "whitespace-nowrap tabular-nums")}>{fmtDate(a.fromDate)}</td>
                    <td className={cn(TABLE.td, "whitespace-nowrap tabular-nums")}>{fmtDate(a.toDate)}</td>
                    <td className={cn(TABLE.td, "tabular-nums")}>{a.days}</td>
                    <td className={cn(TABLE.td, "whitespace-nowrap text-ink-muted")}>{fmtDateTime(a.appliedAt)}</td>
                    <td className={TABLE.td}>
                      <RequestStatusBadge status={a.status} />
                    </td>
                    <td className={cn(TABLE.td, "text-ink-muted")}>{a.status === "Pending" ? a.stage : a.decidedByName ? `by ${a.decidedByName}` : "—"}</td>
                    <td className={cn(TABLE.td, "whitespace-nowrap")}>
                      <div className="flex gap-1">
                        <Link href={essPaths.leaveDetail(a.id)} className={buttonClasses("ghost", "icon")} aria-label={`Open ${a.reference}`} title="Details">
                          <Eye aria-hidden="true" />
                        </Link>
                        {a.canCancel && (
                          <Button size="icon" variant="ghost" aria-label={`Cancel ${a.reference}`} title="Cancel" onClick={() => cancel.ask(a)}>
                            <XCircle aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination className="px-4 py-3" page={paged.page} pageSize={paged.pageSize} totalRecords={paged.totalRecords} totalPages={paged.totalPages} pageSizes={[10, 25, 50]} onPageChange={paged.setPage} onPageSizeChange={paged.setPageSize} noun="applications" />
        </>
      )}
      {cancel.dialog}
    </Panel>
  );
}

// ─── Detail ───────────────────────────────────────────────────────────────────

const STAGE_VARIANT: Record<string, "success" | "danger" | "warning" | "neutral"> = { APPROVED: "success", REJECTED: "danger", PENDING: "warning" };

export function LeaveDetailView({ id }: { id: string }) {
  return (
    <EssPage
      title="Leave Application"
      actions={
        <Link href={essPaths.leaveHistory} className={buttonClasses("secondary", "md")}>
          <ArrowLeft aria-hidden="true" />
          Back
        </Link>
      }
    >
      {() => <Detail id={id} />}
    </EssPage>
  );
}

function Detail({ id }: { id: string }) {
  const data = useResource(`ess-leave-detail:${id}`, () => essApi.leaveDetail(id));
  const cancel = useCancel(data.reload);
  if (data.error) return <Panel><ErrorState message={data.error.message} onRetry={data.reload} /></Panel>;
  if (!data.data) return <Panel><LoadingState label="Loading application…" /></Panel>;
  const a = data.data;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel
        className="lg:col-span-2"
        title={a.reference}
        description={`Applied ${fmtDateTime(a.appliedAt)}`}
        actions={
          <>
            <RequestStatusBadge status={a.status} />
            {a.canCancel && (
              <Button size="sm" onClick={() => cancel.ask(a)}>
                <XCircle aria-hidden="true" />
                Cancel
              </Button>
            )}
          </>
        }
      >
        <FormGrid cols={3}>
          <ReadValue label="Leave Type" value={a.leaveType} />
          <ReadValue label="From" value={fmtDate(a.fromDate)} />
          <ReadValue label="To" value={fmtDate(a.toDate)} />
          <ReadValue label="Days Charged" value={a.days} />
          <ReadValue label="Current Stage" value={a.stage} />
          <ReadValue label="Decided" value={a.decidedAt ? `${fmtDateTime(a.decidedAt)}${a.decidedByName ? ` by ${a.decidedByName}` : ""}` : "—"} />
          <ReadValue label="Reason" value={a.reason} className="sm:col-span-2 lg:col-span-3" />
          <ReadValue label="Contact During Leave" value={a.location} className="sm:col-span-2 lg:col-span-3" />
        </FormGrid>
        {a.attachments.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {a.attachments.map((f) => (
              <li key={f.id}>
                <a href={essApi.attachmentUrl(a.id, f.id)} className="inline-flex min-h-8 items-center gap-1.5 rounded border border-line px-2.5 text-xs font-medium text-ink hover:bg-control focus-visible:outline-2">
                  <Paperclip aria-hidden="true" className="size-3.5" />
                  {f.name}
                </a>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Approval Progress">
        {a.trail.length === 0 ? (
          <p className="text-sm text-ink-muted">{a.status === "Pending" ? "Waiting for an approver with leave approval permission." : `${a.status}${a.decidedByName ? ` by ${a.decidedByName}` : ""}.`}</p>
        ) : (
          <ol className="flex flex-col">
            {a.trail.map((s) => (
              <li key={s.stageNo} className="relative flex gap-3 pb-4 last:pb-0">
                <span aria-hidden="true" className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold", s.status === "APPROVED" ? "border-success bg-success/10 text-success" : s.status === "REJECTED" ? "border-danger bg-danger/10 text-danger" : "border-line-strong bg-surface text-ink-muted")}>
                  {s.stageNo}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-ink">
                    {s.name} <Badge variant={STAGE_VARIANT[s.status] ?? "neutral"}>{s.status === "PENDING" ? "Waiting" : s.status.charAt(0) + s.status.slice(1).toLowerCase()}</Badge>
                  </p>
                  <p className="text-xs text-ink-muted">{s.actedBy ? `${s.actedBy}${s.actedAt ? ` · ${fmtDateTime(s.actedAt)}` : ""}` : s.approverNames.length ? `Approver: ${s.approverNames.join(", ")}` : "Any approver"}</p>
                  {s.comment && <p className="mt-1 rounded bg-canvas px-2 py-1 text-xs text-ink">“{s.comment}”</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>
      {cancel.dialog}
    </div>
  );
}
