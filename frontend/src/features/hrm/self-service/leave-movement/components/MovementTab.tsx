"use client";

import { MapPinned, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { ApiClientError, errorMessage } from "@/lib/api/client";
import { EmptyBlock, Field, FormGrid, Input, Notice, Panel, Select, TABLE, TextArea } from "@/features/configuration/entity-master-data/employee/components/kit";
import { MOVEMENT_TYPES, type EmployeeOption, type LeaveMovementOptions } from "../schemas/leave-movement.schema";
import { leaveMovementApi } from "../services/leave-movement.api";
import { ApplicationActions, ApplicationStatusBadge, EmployeeField, Grid, formatDate, formatDay } from "./shared";

const EMPTY = { movementType: "", fromDate: "", toDate: "", startTime: "", endTime: "", location: "", reason: "" };

export function MovementTab({ options }: { options: LeaveMovementOptions }) {
  const toast = useToast();
  const [employee, setEmployee] = useState<EmployeeOption | null>(options.self);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState("");
  const [saving, setSaving] = useState(false);
  const list = useResource("movement-list", leaveMovementApi.movements);
  const set = (key: keyof typeof EMPTY) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!employee) next.employeeId = "Select an employee.";
    if (!form.movementType) next.movementType = "Select a type.";
    if (!form.fromDate) next.fromDate = "Enter a date.";
    if (!form.toDate) next.toDate = "Enter a date.";
    else if (form.fromDate && form.toDate < form.fromDate) next.toDate = "Cannot be before From Date.";
    if (!form.startTime) next.startTime = "Enter a time.";
    if (!form.endTime) next.endTime = "Enter a time.";
    else if (form.startTime && form.endTime <= form.startTime) next.endTime = "Must be after Start Time.";
    if (!form.location.trim()) next.location = "Enter a location.";
    if (!form.reason.trim()) next.reason = "Enter a reason.";
    setErrors(next);
    setFailure("");
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      await leaveMovementApi.applyMovement({ ...form, movementType: form.movementType as (typeof MOVEMENT_TYPES)[number], employeeId: options.canManage ? employee?.id : undefined });
      toast.success("Movement application submitted for approval.");
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

  return (
    <div className="flex flex-col gap-4 p-4">
      <form onSubmit={submit} noValidate>
        <Panel
          title="Apply for Movement"
          description="Movement does not use your leave balance."
          footer={
            <Button type="submit" variant="primary" loading={saving}>
              <Send aria-hidden="true" className="size-3.5" />
              Apply
            </Button>
          }
        >
          <div className="flex flex-col gap-3">
            {failure && <Notice tone="error">{failure}</Notice>}
            <FormGrid cols={4}>
              <Field label="Employee" required span={2} error={errors.employeeId}>
                {(id) => <EmployeeField id={id} options={options} value={employee} onChange={setEmployee} />}
              </Field>
              <Field label="Leave Type" required error={errors.movementType}>
                {(id) => <Select id={id} value={form.movementType} onChange={(e) => set("movementType")(e.target.value)} options={MOVEMENT_TYPES} aria-invalid={!!errors.movementType} />}
              </Field>
              <Field label="Location" required error={errors.location}>
                {(id) => <Input id={id} value={form.location} maxLength={150} onChange={(e) => set("location")(e.target.value)} aria-invalid={!!errors.location} />}
              </Field>
              <Field label="From Date" required error={errors.fromDate}>
                {(id) => <Input id={id} type="date" value={form.fromDate} onChange={(e) => set("fromDate")(e.target.value)} aria-invalid={!!errors.fromDate} />}
              </Field>
              <Field label="To Date" required error={errors.toDate}>
                {(id) => <Input id={id} type="date" value={form.toDate} min={form.fromDate || undefined} onChange={(e) => set("toDate")(e.target.value)} aria-invalid={!!errors.toDate} />}
              </Field>
              <Field label="Start Time" required error={errors.startTime}>
                {(id) => <Input id={id} type="time" value={form.startTime} onChange={(e) => set("startTime")(e.target.value)} aria-invalid={!!errors.startTime} />}
              </Field>
              <Field label="End Time" required error={errors.endTime} hint="Each day.">
                {(id) => <Input id={id} type="time" value={form.endTime} onChange={(e) => set("endTime")(e.target.value)} aria-invalid={!!errors.endTime} />}
              </Field>
              <Field label="Reason" required span="full" error={errors.reason}>
                {(id) => <TextArea id={id} value={form.reason} maxLength={500} onChange={(e) => set("reason")(e.target.value)} aria-invalid={!!errors.reason} />}
              </Field>
            </FormGrid>
          </div>
        </Panel>
      </form>

      <Panel title="Movement List" flush>
        {list.error ? (
          <ErrorState message={list.error.message} onRetry={list.reload} />
        ) : !list.data ? (
          <LoadingState label="Loading movement applications…" />
        ) : list.data.length === 0 ? (
          <div className="p-4">
            <EmptyBlock icon={<MapPinned />} title="No movement applications yet" />
          </div>
        ) : (
          <div className="p-4">
            <Grid
              headers={["SL", "Action", ...(options.canManage ? ["Employee"] : []), "Leave Type", "From Date", "To Date", "Start Time", "End Time", "Location", "Reason", "Status", "Applied On"]}
              loading={list.loading}
            >
              {list.data.map((row, index) => (
                <tr key={row.id} className={TABLE.row}>
                  <td className={`${TABLE.td} text-right text-ink-faint tabular-nums`}>{index + 1}</td>
                  <td className={`${TABLE.td} px-1 py-1`}>
                    <ApplicationActions kind="movements" row={row} onDone={list.reload} />
                  </td>
                  {options.canManage && (
                    <td className={`${TABLE.td} whitespace-nowrap`}>
                      <span className="tabular-nums">{row.employeeCode}</span> — {row.employeeName}
                    </td>
                  )}
                  <td className={`${TABLE.td} whitespace-nowrap`}>{row.movementType}</td>
                  <td className={`${TABLE.td} whitespace-nowrap tabular-nums`}>{formatDate(row.fromDate)}</td>
                  <td className={`${TABLE.td} whitespace-nowrap tabular-nums`}>{formatDate(row.toDate)}</td>
                  <td className={`${TABLE.td} tabular-nums`}>{row.startTime}</td>
                  <td className={`${TABLE.td} tabular-nums`}>{row.endTime}</td>
                  <td className={TABLE.td}>{row.location}</td>
                  <td className={`${TABLE.td} max-w-72 whitespace-normal`}>{row.reason}</td>
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
