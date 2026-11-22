"use client";

import { ClipboardCheck, Send, Undo2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { ApiClientError, errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { CONTROL_CLASS, EmptyBlock, Field, FormGrid, Input, Notice, Panel, Select, TABLE, TextArea } from "@/features/configuration/entity-master-data/employee/components/kit";
import { ADJUSTABLE_STATUSES } from "@/features/hrm/attendance/types";
import { essApi } from "../api";
import { CORRECTION_TYPES, type CorrectionType, type EssCorrection, type EssEmployee } from "../types";
import { DayStatusBadge, EssPage, RequestStatusBadge, fmtDate, fmtDateTime, localToday, usePaged } from "./ess-ui";
import { Pagination } from "@/components/ui/pagination";

/** The status each correction type usually asks for (the employee can change it). */
const DEFAULT_STATUS: Record<CorrectionType, string> = { "Missing Check-In": "Present", "Missing Check-Out": "Present", "Incorrect Attendance": "Present", "Shift Mismatch": "Present", Other: "Present" };

export function CorrectionsView() {
  return (
    <EssPage title="Attendance Corrections" subtitle="Ask HR to correct a missing punch or a wrong status. Your attendance changes only after the request is approved.">
      {(employee) => <Corrections employee={employee} />}
    </EssPage>
  );
}

function Corrections({ employee }: { employee: EssEmployee }) {
  const toast = useToast();
  const params = useSearchParams();
  const initialDate = params.get("date") && /^\d{4}-\d{2}-\d{2}$/.test(params.get("date")!) ? params.get("date")! : localToday();
  const empty = { date: initialDate, correctionType: "Missing Check-In" as CorrectionType, requestedStatus: "Present", inTime: "", outTime: "", reason: "" };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [withdrawing, setWithdrawing] = useState<EssCorrection | null>(null);
  const [busy, setBusy] = useState(false);

  const list = useResource("ess-corrections", essApi.corrections);
  const day = useResource(form.date ? `ess-day:${form.date}` : null, () => essApi.day(form.date));
  const paged = usePaged(list.data ?? [], 10);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!form.date) next.date = "Choose the date.";
    else if (form.date > localToday()) next.date = "You can only correct today or an earlier day.";
    if (form.correctionType === "Missing Check-In" && !form.inTime) next.inTime = "Enter the check-in time.";
    if (form.correctionType === "Missing Check-Out" && !form.outTime) next.outTime = "Enter the check-out time.";
    if (!form.reason.trim()) next.reason = "Explain what happened.";
    setErrors(next);
    setFailure("");
    setNotice("");
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      const result = await essApi.requestCorrection(form);
      toast.success("Correction submitted for HR approval.");
      setNotice(result.warning ?? "");
      setForm({ ...empty, date: form.date });
      list.reload();
      day.reload();
    } catch (error) {
      if (error instanceof ApiClientError && Object.keys(error.fieldErrors).length) setErrors(Object.fromEntries(Object.entries(error.fieldErrors).map(([k, v]) => [k, v[0]])));
      setFailure(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function withdraw() {
    if (!withdrawing) return;
    setBusy(true);
    try {
      await essApi.withdrawCorrection(withdrawing.id);
      toast.success("Request withdrawn.");
      setWithdrawing(null);
      list.reload();
      day.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {employee.canApply ? (
        <form onSubmit={submit} noValidate>
          <Panel
            title="Request a Correction"
            description="Corrections can be requested for the last 60 days."
            footer={
              <Button type="submit" variant="primary" loading={saving}>
                <Send aria-hidden="true" />
                Submit Request
              </Button>
            }
          >
            <div className="flex flex-col gap-4">
              {failure && <Notice tone="error">{failure}</Notice>}
              {notice && <p className="rounded border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-warning" role="status">{notice}</p>}
              <FormGrid cols={3}>
                <Field label="Attendance Date" required error={errors.date}>
                  {(id) => <DateInput className={CONTROL_CLASS} id={id} value={form.date} onChange={(date) => set("date", date)} aria-invalid={!!errors.date} />}
                </Field>
                <Field label="Existing Status">
                  <div className="flex h-8 items-center gap-2 text-[13px]">
                    {day.loading && !day.data ? (
                      <span className="text-ink-faint">Checking…</span>
                    ) : day.error ? (
                      <span className="text-ink-faint">{day.error.message}</span>
                    ) : day.data ? (
                      <>
                        <DayStatusBadge status={day.data.day.status} provisional={day.data.day.provisional} />
                        <span className="truncate text-xs text-ink-muted">
                          {day.data.day.actualIn ?? "no check-in"} – {day.data.day.actualOut ?? "no check-out"}
                        </span>
                      </>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </div>
                </Field>
                <Field label="Correction Type" required>
                  {(id) => (
                    <Select
                      id={id}
                      placeholder={false}
                      value={form.correctionType}
                      onChange={(e) => {
                        const type = e.target.value as CorrectionType;
                        setForm((f) => ({ ...f, correctionType: type, requestedStatus: DEFAULT_STATUS[type] }));
                      }}
                      options={CORRECTION_TYPES}
                    />
                  )}
                </Field>
                <Field label="Requested Status" required hint="What the day should be once corrected.">
                  {(id) => <Select id={id} placeholder={false} value={form.requestedStatus} onChange={(e) => set("requestedStatus", e.target.value)} options={ADJUSTABLE_STATUSES} />}
                </Field>
                <Field label="Requested Check-In" required={form.correctionType === "Missing Check-In"} error={errors.inTime}>
                  {(id) => <Input id={id} type="time" value={form.inTime} onChange={(e) => set("inTime", e.target.value)} aria-invalid={!!errors.inTime} />}
                </Field>
                <Field label="Requested Check-Out" required={form.correctionType === "Missing Check-Out"} error={errors.outTime}>
                  {(id) => <Input id={id} type="time" value={form.outTime} onChange={(e) => set("outTime", e.target.value)} aria-invalid={!!errors.outTime} />}
                </Field>
                <Field label="Reason" required span="full" error={errors.reason}>
                  {(id) => <TextArea id={id} rows={3} maxLength={400} value={form.reason} onChange={(e) => set("reason", e.target.value)} placeholder="e.g. The device was offline when I arrived at 9:02 AM." aria-invalid={!!errors.reason} />}
                </Field>
              </FormGrid>
            </div>
          </Panel>
        </form>
      ) : (
        <Notice tone="error">Your employment record is inactive, so new requests cannot be submitted. Contact HR.</Notice>
      )}

      <Panel title="My Correction Requests" flush>
        {list.error ? (
          <ErrorState message={list.error.message} onRetry={list.reload} />
        ) : !list.data ? (
          <LoadingState label="Loading requests…" />
        ) : list.data.length === 0 ? (
          <div className="p-4">
            <EmptyBlock icon={<ClipboardCheck />} title="No correction requests yet" />
          </div>
        ) : (
          <>
            <div className={cn(TABLE.wrap, "rounded-none border-x-0 border-t-0")}>
              <table className={TABLE.table}>
                <thead className={TABLE.head}>
                  <tr>
                    {["Date", "Was", "Requested", "In", "Out", "Reason", "Requested On", "Status", "Action"].map((h) => (
                      <th key={h} scope="col" className={TABLE.th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.rows.map((r) => (
                    <tr key={r.id} className={TABLE.row}>
                      <td className={cn(TABLE.td, "whitespace-nowrap tabular-nums")}>{fmtDate(r.date)}</td>
                      <td className={TABLE.td}>{r.originalStatus ?? "—"}</td>
                      <td className={cn(TABLE.td, "font-medium")}>{r.requestedStatus}</td>
                      <td className={cn(TABLE.td, "whitespace-nowrap")}>{r.inTime ?? "—"}</td>
                      <td className={cn(TABLE.td, "whitespace-nowrap")}>{r.outTime ?? "—"}</td>
                      <td className={cn(TABLE.td, "max-w-72 truncate")} title={r.reason ?? undefined}>
                        {r.reason ?? "—"}
                      </td>
                      <td className={cn(TABLE.td, "whitespace-nowrap text-ink-muted")}>{fmtDateTime(r.requestedAt)}</td>
                      <td className={TABLE.td}>
                        <RequestStatusBadge status={r.status} />
                      </td>
                      <td className={TABLE.td}>
                        {r.status === "Pending" ? (
                          <Button size="sm" variant="ghost" onClick={() => setWithdrawing(r)} aria-label={`Withdraw the request for ${fmtDate(r.date)}`}>
                            <Undo2 aria-hidden="true" />
                            Withdraw
                          </Button>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination className="px-4 py-3" page={paged.page} pageSize={paged.pageSize} totalRecords={paged.totalRecords} totalPages={paged.totalPages} pageSizes={[10, 25, 50]} onPageChange={paged.setPage} onPageSizeChange={paged.setPageSize} noun="requests" />
          </>
        )}
      </Panel>

      <ConfirmDialog
        open={withdrawing !== null}
        title="Withdraw request"
        message={withdrawing ? `Withdraw your correction request for ${fmtDate(withdrawing.date)}? HR will no longer see it.` : ""}
        confirmLabel="Withdraw"
        busy={busy}
        onConfirm={() => void withdraw()}
        onClose={() => setWithdrawing(null)}
      />
    </>
  );
}
