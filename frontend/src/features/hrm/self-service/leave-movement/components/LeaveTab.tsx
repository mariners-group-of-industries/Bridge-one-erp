"use client";

import { CalendarOff, Paperclip, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { ApiClientError, errorMessage } from "@/lib/api/client";
import { EmptyBlock, Field, FormGrid, Input, Notice, Panel, Select, TABLE, TextArea } from "@/features/configuration/entity-master-data/employee/components/kit";
import { LEAVE_TYPES, MAX_LEAVE_ATTACHMENTS, type EmployeeOption, type LeaveMovementOptions } from "../schemas/leave-movement.schema";
import { leaveMovementApi } from "../services/leave-movement.api";
import { ApplicationActions, ApplicationStatusBadge, EmployeeField, Grid, formatDate, formatDay } from "./shared";

const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";
const EMPTY = { leaveType: "", fromDate: "", toDate: "", location: "", reason: "" };
const dayCount = (from: string, to: string) => (from && to && to >= from ? Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1 : 0);

export function LeaveTab({ options }: { options: LeaveMovementOptions }) {
  const toast = useToast();
  const [employee, setEmployee] = useState<EmployeeOption | null>(options.self);
  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState("");
  const [saving, setSaving] = useState(false);

  const balance = useResource(employee ? `leave-balance:${employee.id}` : null, () => leaveMovementApi.balance(options.canManage ? employee?.id : undefined));
  const list = useResource("leave-list", leaveMovementApi.leaves);
  const days = dayCount(form.fromDate, form.toDate);
  const set = (key: keyof typeof EMPTY) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!employee) next.employeeId = "Select an employee.";
    if (!form.leaveType) next.leaveType = "Select a leave type.";
    if (!form.fromDate) next.fromDate = "Enter a date.";
    if (!form.toDate) next.toDate = "Enter a date.";
    else if (form.fromDate && form.toDate < form.fromDate) next.toDate = "Cannot be before From Date.";
    if (!form.reason.trim()) next.reason = "Enter a reason.";
    if (files.length > MAX_LEAVE_ATTACHMENTS) next.files = `Attach at most ${MAX_LEAVE_ATTACHMENTS} files.`;
    setErrors(next);
    setFailure("");
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      await leaveMovementApi.applyLeave({ ...form, employeeId: options.canManage ? employee?.id : undefined }, files);
      toast.success("Leave application submitted for approval.");
      setForm(EMPTY);
      setFiles([]);
      setFileInputKey((k) => k + 1);
      balance.reload();
      list.reload();
    } catch (error) {
      if (error instanceof ApiClientError && Object.keys(error.fieldErrors).length) {
        setErrors(Object.fromEntries(Object.entries(error.fieldErrors).map(([key, messages]) => [key, messages[0]])));
      }
      setFailure(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <form onSubmit={submit} noValidate>
        <Panel
          title="Apply for Leave"
          description={days ? `${days} day${days === 1 ? "" : "s"}` : undefined}
          footer={
            <Button type="submit" variant="primary" loading={saving}>
              <Send aria-hidden="true" className="size-3.5" />
              Apply
            </Button>
          }
        >
          <div className="flex flex-col gap-3">
            {failure && <Notice tone="error">{failure}</Notice>}
            <FormGrid cols={3}>
              <Field label="Employee" required error={errors.employeeId}>
                {(id) => <EmployeeField id={id} options={options} value={employee} onChange={setEmployee} />}
              </Field>
              <Field label="Leave Type" required error={errors.leaveType}>
                {(id) => <Select id={id} value={form.leaveType} onChange={(e) => set("leaveType")(e.target.value)} options={LEAVE_TYPES.map((t) => t.name)} aria-invalid={!!errors.leaveType} />}
              </Field>
              <Field label="Location" error={errors.location} hint="Where you will be during the leave.">
                {(id) => <Input id={id} value={form.location} maxLength={150} onChange={(e) => set("location")(e.target.value)} />}
              </Field>
              <Field label="From Date" required error={errors.fromDate}>
                {(id) => <Input id={id} type="date" value={form.fromDate} onChange={(e) => set("fromDate")(e.target.value)} aria-invalid={!!errors.fromDate} />}
              </Field>
              <Field label="To Date" required error={errors.toDate}>
                {(id) => <Input id={id} type="date" value={form.toDate} min={form.fromDate || undefined} onChange={(e) => set("toDate")(e.target.value)} aria-invalid={!!errors.toDate} />}
              </Field>
              <Field label="Attachments" error={errors.files} hint={`Up to ${MAX_LEAVE_ATTACHMENTS} files — PDF, PNG, JPEG or WebP, 5 MB each.`}>
                {(id) => (
                  <input
                    key={fileInputKey}
                    id={id}
                    type="file"
                    multiple
                    accept={ACCEPT}
                    onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                    className="text-xs text-ink-muted file:mr-2 file:h-8 file:rounded file:border file:border-line-strong file:bg-surface file:px-2.5 file:text-xs file:text-ink-muted hover:file:bg-control"
                  />
                )}
              </Field>
              <Field label="Reason" required span="full" error={errors.reason}>
                {(id) => <TextArea id={id} value={form.reason} maxLength={500} onChange={(e) => set("reason")(e.target.value)} aria-invalid={!!errors.reason} />}
              </Field>
            </FormGrid>
          </div>
        </Panel>
      </form>

      <Panel title="Leave Balance" description={employee ? `${employee.code} — ${employee.name}, ${new Date().getFullYear()}` : "Select an employee to see the balance."} flush>
        {!employee ? null : balance.error ? (
          <ErrorState message={balance.error.message} onRetry={balance.reload} />
        ) : !balance.data ? (
          <LoadingState label="Loading balance…" />
        ) : (
          <div className="p-4">
            <Grid headers={["Leave Type", "Remaining", "Taken", "Quota"]} loading={balance.loading}>
              {balance.data.map((b) => (
                <tr key={b.leaveType} className={TABLE.row}>
                  <td className={TABLE.td}>{b.leaveType}</td>
                  <td className={`${TABLE.td} text-right font-semibold tabular-nums ${b.remaining !== null && b.remaining <= 0 ? "text-danger" : ""}`}>{b.remaining ?? "—"}</td>
                  <td className={`${TABLE.td} text-right tabular-nums`}>
                    {b.taken}
                    {b.pending > 0 && <span className="ml-1 text-xs text-warning">(+{b.pending} pending)</span>}
                  </td>
                  <td className={`${TABLE.td} text-right tabular-nums`}>{b.quota ?? "No limit"}</td>
                </tr>
              ))}
            </Grid>
          </div>
        )}
      </Panel>

      <Panel title="Leave List" flush>
        {list.error ? (
          <ErrorState message={list.error.message} onRetry={list.reload} />
        ) : !list.data ? (
          <LoadingState label="Loading leave applications…" />
        ) : list.data.length === 0 ? (
          <div className="p-4">
            <EmptyBlock icon={<CalendarOff />} title="No leave applications yet" />
          </div>
        ) : (
          <div className="p-4">
            <Grid
              headers={["SL", "Action", ...(options.canManage ? ["Employee"] : []), "Leave Type", "From Date", "To Date", "Days", "Location", "Reason", "Attachments", "Status", "Applied On"]}
              loading={list.loading}
            >
              {list.data.map((row, index) => (
                <tr key={row.id} className={TABLE.row}>
                  <td className={`${TABLE.td} text-right text-ink-faint tabular-nums`}>{index + 1}</td>
                  <td className={`${TABLE.td} px-1 py-1`}>
                    <ApplicationActions
                      kind="leaves"
                      row={row}
                      onDone={() => {
                        list.reload();
                        balance.reload();
                      }}
                    />
                  </td>
                  {options.canManage && (
                    <td className={`${TABLE.td} whitespace-nowrap`}>
                      <span className="tabular-nums">{row.employeeCode}</span> — {row.employeeName}
                    </td>
                  )}
                  <td className={`${TABLE.td} whitespace-nowrap`}>{row.leaveType}</td>
                  <td className={`${TABLE.td} whitespace-nowrap tabular-nums`}>{formatDate(row.fromDate)}</td>
                  <td className={`${TABLE.td} whitespace-nowrap tabular-nums`}>{formatDate(row.toDate)}</td>
                  <td className={`${TABLE.td} text-right tabular-nums`}>{row.days}</td>
                  <td className={TABLE.td}>{row.location || <span className="text-ink-faint">—</span>}</td>
                  <td className={`${TABLE.td} max-w-72 whitespace-normal`}>{row.reason}</td>
                  <td className={TABLE.td}>
                    {row.attachments.length === 0 ? (
                      <span className="text-ink-faint">—</span>
                    ) : (
                      <ul className="flex flex-col gap-0.5">
                        {row.attachments.map((file) => (
                          <li key={file.id}>
                            <a href={leaveMovementApi.attachmentUrl(row.id, file.id)} className="inline-flex items-center gap-1 text-accent-strong hover:underline dark:text-accent">
                              <Paperclip aria-hidden="true" className="size-3" />
                              <span className="max-w-40 truncate">{file.name}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className={TABLE.td} title={row.decidedByName ? `${row.status} by ${row.decidedByName}` : undefined}>
                    <ApplicationStatusBadge status={row.status} />
                  </td>
                  <td className={`${TABLE.td} whitespace-nowrap tabular-nums`}>{formatDay(row.appliedAt)}</td>
                </tr>
              ))}
            </Grid>
          </div>
        )}
      </Panel>
    </div>
  );
}
