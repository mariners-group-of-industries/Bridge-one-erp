"use client";

import { CalendarClock, Send, Undo2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { DateInput, isoToDmy } from "@/components/ui/date-input";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { ApiClientError, errorMessage } from "@/lib/api/client";
import { CONTROL_CLASS, EmptyBlock, Field, FormGrid, Input, Notice, Panel, Select, TABLE, TextArea } from "@/features/configuration/entity-master-data/employee/components/kit";
import { ADJUSTABLE_STATUSES, type AttendanceRecord } from "@/features/hrm/attendance/types";
import type { ApplicationStatus, LeaveMovementOptions } from "../schemas/leave-movement.schema";
import { leaveMovementApi } from "../services/leave-movement.api";
import { ApplicationStatusBadge, Grid, formatDay } from "./shared";

const EMPTY = { date: "", requestedStatus: "", inTime: "", outTime: "", reason: "" };

/**
 * Employee Self Service › Attendance: an employee asks HR to change their own
 * attendance for a day. The request goes through the "Employee Attendance"
 * pipeline of Approval Setup; the status changes only once HR approves.
 */
export function AttendanceTab({ options }: { options: LeaveMovementOptions }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState("");
  const [saving, setSaving] = useState(false);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  // The last loaded day; shown only while it is still the chosen date.
  const [day, setDay] = useState<{ date: string; row: AttendanceRecord | null; error?: string } | null>(null);
  const list = useResource(options.self ? "attendance-request-list" : null, leaveMovementApi.attendanceRequests);
  const set = (key: keyof typeof EMPTY) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  };

  // The chosen day's current attendance, so the employee sees what they are changing.
  useEffect(() => {
    if (!form.date || !options.self) return;
    let live = true;
    const date = form.date;
    leaveMovementApi.attendanceDay(date).then(
      (r) => live && setDay({ date, row: r.day }),
      (e: unknown) => live && setDay({ date, row: null, error: errorMessage(e) }),
    );
    return () => {
      live = false;
    };
  }, [form.date, options.self]);

  if (!options.self) {
    return (
      <div className="p-4">
        <Notice tone="error">No employee record is linked to your account, so you cannot ask for an attendance change. Ask HR to link your login to your employee record.</Notice>
      </div>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!form.date) next.date = "Choose the day.";
    if (!form.requestedStatus) next.requestedStatus = "Choose the status you need.";
    if (form.inTime && form.outTime && form.outTime <= form.inTime) next.outTime = "Must be after In Time.";
    if (!form.reason.trim()) next.reason = "Enter the reason for the change.";
    setErrors(next);
    setFailure("");
    if (Object.values(next).some(Boolean)) return;

    setSaving(true);
    try {
      await leaveMovementApi.requestAttendance(form);
      toast.success("Attendance change sent to HR for approval.");
      setForm(EMPTY);
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

  async function withdraw(id: string) {
    setWithdrawing(id);
    try {
      await leaveMovementApi.withdrawAttendance(id);
      toast.success("Request withdrawn.");
      list.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setWithdrawing(null);
    }
  }

  const current = !form.date ? null : day && day.date === form.date ? { ...day, loading: false } : { date: form.date, row: null, loading: true, error: undefined };

  return (
    <div className="flex flex-col gap-4 p-4">
      <form onSubmit={submit} noValidate>
        <Panel
          title="Ask for an Attendance Change"
          description="For a day that is wrong, e.g. a missed punch or a day on duty outside the office. HR approves it through Approval Setup; your attendance changes only once it is approved."
          footer={
            <Button type="submit" variant="primary" loading={saving}>
              <Send aria-hidden="true" className="size-3.5" />
              Send to HR
            </Button>
          }
        >
          <div className="flex flex-col gap-3">
            {failure && <Notice tone="error">{failure}</Notice>}
            <FormGrid cols={4}>
              <Field label="Date" required error={errors.date} hint="Today or up to 60 days back.">
                {(id) => <DateInput id={id} value={form.date} onChange={set("date")} className={CONTROL_CLASS} aria-invalid={!!errors.date} />}
              </Field>
              <Field label="Current Attendance">
                {() => (
                  <div className="flex h-8 items-center text-[12px] text-ink" aria-live="polite">
                    {!current ? (
                      <span className="text-ink-faint">Choose a day</span>
                    ) : current.loading ? (
                      <span className="text-ink-faint">Loading…</span>
                    ) : current.error ? (
                      <span className="text-danger">{current.error}</span>
                    ) : current.row ? (
                      <span>
                        <strong>{current.row.actualAttendance}</strong>
                        <span className="text-ink-muted">
                          {" "}
                          · {current.row.inTime ?? "no in"} – {current.row.outTime ?? "no out"} · {current.row.calendarName}
                        </span>
                      </span>
                    ) : (
                      <span className="text-ink-muted">No record for this day</span>
                    )}
                  </div>
                )}
              </Field>
              <Field label="Change To" required error={errors.requestedStatus}>
                {(id) => <Select id={id} value={form.requestedStatus} onChange={(e) => set("requestedStatus")(e.target.value)} options={ADJUSTABLE_STATUSES} aria-invalid={!!errors.requestedStatus} />}
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="In Time" error={errors.inTime}>
                  {(id) => <Input id={id} type="time" value={form.inTime} onChange={(e) => set("inTime")(e.target.value)} aria-invalid={!!errors.inTime} />}
                </Field>
                <Field label="Out Time" error={errors.outTime}>
                  {(id) => <Input id={id} type="time" value={form.outTime} onChange={(e) => set("outTime")(e.target.value)} aria-invalid={!!errors.outTime} />}
                </Field>
              </div>
              <Field label="Reason" required span="full" error={errors.reason}>
                {(id) => <TextArea id={id} value={form.reason} maxLength={500} placeholder="e.g. The device did not take my punch at 9:02 AM." onChange={(e) => set("reason")(e.target.value)} aria-invalid={!!errors.reason} />}
              </Field>
            </FormGrid>
          </div>
        </Panel>
      </form>

      <Panel title="My Attendance Requests" flush>
        {list.error ? (
          <ErrorState message={list.error.message} onRetry={list.reload} />
        ) : !list.data ? (
          <LoadingState label="Loading your requests…" />
        ) : list.data.length === 0 ? (
          <div className="p-4">
            <EmptyBlock icon={<CalendarClock />} title="No attendance requests yet" />
          </div>
        ) : (
          <div className="p-4">
            <Grid headers={["SL", "Action", "Date", "Was", "Change To", "In Time", "Out Time", "Reason", "Status", "Requested On"]} loading={list.loading}>
              {list.data.map((row, index) => (
                <tr key={row.id} className={TABLE.row}>
                  <td className={`${TABLE.td} text-right text-ink-faint tabular-nums`}>{index + 1}</td>
                  <td className={`${TABLE.td} px-1 py-1`}>
                    {row.status === "Pending" ? (
                      <Button size="sm" variant="ghost" loading={withdrawing === row.id} onClick={() => withdraw(row.id)} aria-label={`Withdraw the request for ${isoToDmy(row.date)}`}>
                        <Undo2 aria-hidden="true" className="size-3.5" />
                        Withdraw
                      </Button>
                    ) : (
                      <span className="px-2 text-ink-faint">—</span>
                    )}
                  </td>
                  <td className={`${TABLE.td} whitespace-nowrap tabular-nums`}>{isoToDmy(row.date)}</td>
                  <td className={TABLE.td}>{row.originalStatus ?? "—"}</td>
                  <td className={`${TABLE.td} font-medium`}>{row.requestedStatus}</td>
                  <td className={`${TABLE.td} tabular-nums`}>{row.inTime ?? "—"}</td>
                  <td className={`${TABLE.td} tabular-nums`}>{row.outTime ?? "—"}</td>
                  <td className={`${TABLE.td} max-w-72 whitespace-normal`}>{row.remarks}</td>
                  <td className={TABLE.td}>
                    <ApplicationStatusBadge status={row.status as ApplicationStatus} />
                  </td>
                  <td className={`${TABLE.td} whitespace-nowrap tabular-nums`}>{formatDay(row.requestedAt)}</td>
                </tr>
              ))}
            </Grid>
          </div>
        )}
      </Panel>
    </div>
  );
}
