"use client";

import { Check, Plus, Trash2, TrendingUp, X } from "lucide-react";
import { useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { apiRequest, errorMessage } from "@/lib/api/client";
import { resolveBreadcrumbs } from "@/lib/navigation/registry";
import { EmptyBlock, Field, FormGrid, Input, Notice, Select, TABLE, TextArea } from "@/features/configuration/entity-master-data/employee/components/kit";
import type { EmployeeOption } from "../../self-service/leave-movement/schemas/leave-movement.schema";
import { ApplicationStatusBadge, EmployeeField, Grid } from "../../self-service/leave-movement/components/shared";
import { hrmPaths } from "../../paths";
import { FilterBar, FilterField, OfficeSelect, formatDate, formatMoney, useHrOptions } from "../../shared/hr-ui";
import { APPROVAL_STATUSES, INCREMENT_TYPES, type IncrementRow } from "../types";

const td = TABLE.td;
const num = `${TABLE.td} text-right tabular-nums`;
const EMPTY_FILTER = { officeId: "", status: "", fromDate: "", toDate: "" };

export function IncrementView() {
  const toast = useToast();
  const options = useHrOptions();
  const [filter, setFilter] = useState(EMPTY_FILTER);
  const [applied, setApplied] = useState(EMPTY_FILTER);
  const query = new URLSearchParams(Object.entries(applied).filter(([, v]) => v)).toString();
  const list = useResource(`hrm-increments?${query}`, () => apiRequest<IncrementRow[]>(`/api/hrm/increments?${query}`));
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState<{ row: IncrementRow; action: "approve" | "reject" | "delete" } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof EMPTY_FILTER) => (value: string) => setFilter((f) => ({ ...f, [key]: value }));

  async function act() {
    if (!confirm) return;
    const { row, action } = confirm;
    setBusy(true);
    try {
      await apiRequest(action === "delete" ? `/api/hrm/increments/${row.id}` : `/api/hrm/increments/${row.id}/${action}`, { method: action === "delete" ? "DELETE" : "POST" });
      toast.success(action === "delete" ? "Increment deleted." : action === "approve" ? "Increment approved; the salary is updated." : "Increment rejected.");
      setConfirm(null);
      list.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageContainer full>
      <PageHead
        title="Increment"
        subtitle="Salary increments. Approving one updates the employee's salary."
        breadcrumbs={resolveBreadcrumbs(hrmPaths.increment).slice(1)}
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" className="size-3.5" />
            Increment
          </Button>
        }
      />
      <div className="flex flex-col gap-3">
        <FilterBar onSubmit={() => setApplied(filter)} busy={list.loading}>
          <FilterField label="Office" width="w-64">
            {(id) => <OfficeSelect id={id} options={options.data} value={filter.officeId} onChange={set("officeId")} />}
          </FilterField>
          <FilterField label="Status" width="w-36">
            {(id) => <Select id={id} value={filter.status} onChange={(e) => set("status")(e.target.value)} placeholder="All statuses" options={APPROVAL_STATUSES} />}
          </FilterField>
          <FilterField label="From Date" width="w-40">
            {(id) => <Input id={id} type="date" value={filter.fromDate} onChange={(e) => set("fromDate")(e.target.value)} />}
          </FilterField>
          <FilterField label="To Date" width="w-40">
            {(id) => <Input id={id} type="date" value={filter.toDate} min={filter.fromDate || undefined} onChange={(e) => set("toDate")(e.target.value)} />}
          </FilterField>
        </FilterBar>

        <section className="rounded border border-line bg-surface p-4 shadow-xs">
          {list.error ? (
            <ErrorState message={list.error.message} onRetry={list.reload} />
          ) : !list.data ? (
            <LoadingState label="Loading increments…" />
          ) : list.data.length === 0 ? (
            <EmptyBlock icon={<TrendingUp />} title="No increments found">
              Use + Increment to raise one.
            </EmptyBlock>
          ) : (
            <Grid
              headers={["SL", "Action", "Employee Code", "Employee Name", "Office", "Designation", "Effective Date", "Increment", "Present Gross", "New Gross", "Remarks", "Status"]}
              loading={list.loading}
            >
              {list.data.map((r, i) => (
                <tr key={r.id} className={TABLE.row}>
                  <td className={`${num} text-ink-faint`}>{i + 1}</td>
                  <td className={`${td} px-1 py-1`}>
                    {r.status === "Pending" ? (
                      <div className="flex items-center justify-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:text-success"
                          title="Approve"
                          aria-label={`Approve increment of ${r.employeeName}`}
                          onClick={() => setConfirm({ row: r, action: "approve" })}
                        >
                          <Check />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:text-danger"
                          title="Reject"
                          aria-label={`Reject increment of ${r.employeeName}`}
                          onClick={() => setConfirm({ row: r, action: "reject" })}
                        >
                          <X />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:text-danger"
                          title="Delete"
                          aria-label={`Delete increment of ${r.employeeName}`}
                          onClick={() => setConfirm({ row: r, action: "delete" })}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    ) : (
                      <span className="block text-center text-ink-faint">—</span>
                    )}
                  </td>
                  <td className={`${td} tabular-nums`}>{r.employeeCode}</td>
                  <td className={`${td} whitespace-nowrap`}>{r.employeeName}</td>
                  <td className={td}>{r.officeName}</td>
                  <td className={td}>{r.designation ?? "—"}</td>
                  <td className={`${td} tabular-nums`}>{formatDate(r.effectiveDate)}</td>
                  <td className={num}>{r.incrementType === "Percent" ? `${r.value}%` : formatMoney(r.value)}</td>
                  <td className={num}>{formatMoney(r.previousGross)}</td>
                  <td className={`${num} font-semibold`}>{formatMoney(r.newGross)}</td>
                  <td className={`${td} max-w-60 whitespace-normal`}>{r.remarks || <span className="text-ink-faint">—</span>}</td>
                  <td className={td} title={r.decidedByName ? `${r.status} by ${r.decidedByName}` : undefined}>
                    <ApplicationStatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </Grid>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm ? `${confirm.action[0].toUpperCase()}${confirm.action.slice(1)} increment` : ""}
        message={
          confirm &&
          (confirm.action === "approve"
            ? `Approve the increment of ${confirm.row.employeeName}? Their salary will be raised from ${formatMoney(confirm.row.previousGross)} (the raise is applied to the salary at the time of approval).`
            : `${confirm.action === "reject" ? "Reject" : "Delete"} the increment of ${confirm.row.employeeName}?`)
        }
        confirmLabel={confirm ? `${confirm.action[0].toUpperCase()}${confirm.action.slice(1)}` : ""}
        busy={busy}
        onConfirm={() => void act()}
        onClose={() => setConfirm(null)}
      />
      <CreateIncrementDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          list.reload();
        }}
      />
    </PageContainer>
  );
}

const EMPTY = { effectiveDate: "", incrementType: "Amount", value: "", remarks: "" };

function CreateIncrementDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [employee, setEmployee] = useState<EmployeeOption | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [failure, setFailure] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof EMPTY) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    if (!employee || !form.effectiveDate || !(Number(form.value) > 0)) {
      setFailure("Select an employee and enter the effective date and an increment above 0.");
      return;
    }
    setSaving(true);
    setFailure("");
    try {
      await apiRequest("/api/hrm/increments", { method: "POST", body: JSON.stringify({ ...form, employeeId: employee.id }) });
      toast.success("Increment raised; waiting for approval.");
      setForm(EMPTY);
      setEmployee(null);
      onCreated();
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      title="Add Increment"
      onClose={saving ? () => undefined : onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {failure && <Notice tone="error">{failure}</Notice>}
        <FormGrid cols={2}>
          <Field label="Employee" required span={2}>
            {(id) => <EmployeeField key={open ? "open" : "closed"} id={id} options={{ canManage: true, self: null }} value={employee} onChange={setEmployee} />}
          </Field>
          <Field label="Effective Date" required>
            {(id) => <Input id={id} type="date" value={form.effectiveDate} onChange={(e) => set("effectiveDate")(e.target.value)} />}
          </Field>
          <Field label="Increment Type" required>
            {(id) => (
              <Select
                id={id}
                value={form.incrementType}
                onChange={(e) => set("incrementType")(e.target.value)}
                placeholder={false}
                options={INCREMENT_TYPES.map((t) => ({ value: t, label: t === "Amount" ? "Amount (Tk)" : "Percent of gross (%)" }))}
              />
            )}
          </Field>
          <Field label={form.incrementType === "Percent" ? "Increment (%)" : "Increment Amount"} required>
            {(id) => <Input id={id} type="number" min="0" step="0.01" value={form.value} onChange={(e) => set("value")(e.target.value)} className="text-right" />}
          </Field>
          <Field label="Remarks" span={2}>
            {(id) => <TextArea id={id} value={form.remarks} maxLength={500} onChange={(e) => set("remarks")(e.target.value)} />}
          </Field>
        </FormGrid>
      </div>
    </Dialog>
  );
}
