"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectField, TextField } from "@/components/ui/form-field";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatAmount, formatQty } from "@/features/sales/dashboard/lib/format";
import { masterInputSchema, type MasterKind, type Option } from "../schemas/work-center.schema";
import { createWorkCenterMaster, fetchWorkCenter } from "../services/work-center.api";

export const MASTER_TITLES: Record<MasterKind, string> = {
  types: "Work Center Type",
  departments: "Department",
  sections: "Department Section",
};

/** On/off switch (the list's Active toggle). */
export function Switch({ checked, label, disabled, onChange }: { checked: boolean; label: string; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={checked ? "Active" : "Inactive"}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-4 w-8 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-60",
        checked ? "bg-accent-strong" : "bg-line-strong",
      )}
    >
      <span
        aria-hidden="true"
        className={cn("inline-block size-3 rounded-full bg-surface shadow transition-transform", checked ? "translate-x-4.5" : "translate-x-0.5")}
      />
    </button>
  );
}

/** A field with an "ADD NEW" action on the right of its label. */
export function WithAddNew({ children, onAdd, disabled, label }: { children: ReactNode; onAdd: () => void; disabled?: boolean; label: string }) {
  return (
    <div className="relative">
      {children}
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        aria-label={`Add new ${label}`}
        className="absolute top-0 right-0 text-xs font-medium text-accent-strong hover:underline disabled:cursor-not-allowed disabled:text-ink-faint disabled:no-underline"
      >
        ADD NEW
      </button>
    </div>
  );
}

/**
 * "ADD NEW" dialog for a work center type, department or department section. A section
 * dialog asks for its department (from `departments`, preset to `departmentId`).
 */
export function MasterDialog(props: {
  kind: MasterKind | null;
  businessUnitId?: string;
  departmentId?: string;
  departments?: readonly { id: string; name: string }[];
  onClose: () => void;
  onCreated: (kind: MasterKind, record: Option, departmentId?: string) => void;
}) {
  // Remount per opening so the fields start from the current form values.
  return props.kind ? <MasterForm key={`${props.kind}:${props.departmentId ?? ""}`} {...props} kind={props.kind} /> : null;
}

function MasterForm({
  kind,
  businessUnitId,
  departmentId: presetDepartment,
  departments = [],
  onClose,
  onCreated,
}: Parameters<typeof MasterDialog>[0] & { kind: MasterKind }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [departmentId, setDepartmentId] = useState(presetDepartment ?? "");
  const [errors, setErrors] = useState<{ name?: string; departmentId?: string }>({});
  const [busy, setBusy] = useState(false);
  const title = MASTER_TITLES[kind];

  async function submit() {
    if (kind === "sections" && !departmentId) return setErrors({ departmentId: "Department is required." });
    const input = { name, ...(businessUnitId ? { businessUnitId } : {}), ...(kind === "sections" ? { departmentId } : {}) };
    const parsed = masterInputSchema.safeParse(input);
    if (!parsed.success) return setErrors({ name: parsed.error.issues[0]?.message });
    setBusy(true);
    try {
      const record = await createWorkCenterMaster(kind, input);
      toast.success(`${title} ${record.name} added.`);
      onCreated(kind, record, kind === "sections" ? departmentId : undefined);
    } catch (failure) {
      setErrors({ name: errorMessage(failure) });
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      title={`Create ${title}`}
      onClose={busy ? () => undefined : onClose}
      onSubmit={submit}
      footer={
        <>
          <Button variant="ghost" className="text-danger" onClick={onClose} disabled={busy}>
            CLOSE
          </Button>
          <Button type="submit" variant="primary" loading={busy}>
            SAVE
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {kind === "sections" && (
          <SelectField
            label="Department"
            required
            value={departmentId}
            error={errors.departmentId}
            options={[{ value: "", label: "Choose the department" }, ...departments.map((department) => ({ value: department.id, label: department.name }))]}
            onChange={(event) => setDepartmentId(event.target.value)}
          />
        )}
        <TextField
          label={kind === "departments" ? "Department Name" : title}
          required
          autoFocus
          maxLength={100}
          value={name}
          error={errors.name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
    </Dialog>
  );
}

const show = (value: string | number | null | undefined) => (value === null || value === undefined || value === "" ? "—" : value);

function Pair({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_auto_1fr] gap-x-2 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <span aria-hidden="true" className="text-ink-faint">
        :
      </span>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

/** "Work Station Details" of the list's view (eye) action. */
export function WorkCenterDetailsDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const detail = useResource(id ? `work-center:${id}` : null, () => fetchWorkCenter(id!));
  const data = detail.data;
  return (
    <Dialog
      open={id !== null}
      title="Work Station Details"
      size="xl"
      onClose={onClose}
      footer={
        <Button variant="ghost" className="text-danger" onClick={onClose}>
          CLOSE
        </Button>
      }
    >
      {detail.error ? (
        <ErrorState message={errorMessage(detail.error)} onRetry={detail.reload} />
      ) : !data ? (
        <LoadingState />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid gap-x-8 gap-y-1 md:grid-cols-2">
            <dl className="flex flex-col gap-1">
              <Pair label="Work Center Name" value={data.name} />
              <Pair label="Work Center Code" value={data.code} />
              <Pair label="Work Center Type" value={data.typeName} />
              <Pair label="Department" value={show(data.departmentName)} />
              <Pair label="Department Section" value={show(data.sectionName)} />
              <Pair label="Remarks" value={show(data.remarks)} />
            </dl>
            <dl className="flex flex-col gap-1">
              <Pair label="Standard Run Hour" value={formatQty(data.standardRunHour)} />
              <Pair label="Cost Per Hour" value={data.costPerHour === null ? "—" : formatAmount(data.costPerHour)} />
              <Pair label="Capacity Per Hour" value={formatQty(data.capacityPerHour)} />
              <Pair label="Rated Capacity Per Hour" value={formatQty(data.ratedCapacityPerHour)} />
              <Pair label="Warehouse" value={show(data.warehouseName)} />
              <Pair label="Status" value={data.isActive ? "Active" : "Inactive"} />
            </dl>
          </div>
          <section aria-labelledby="operators-heading" className="flex flex-col gap-2">
            <h3 id="operators-heading" className="text-sm font-semibold text-ink">
              Operators ({data.operators.length})
            </h3>
            {data.operators.length === 0 ? (
              <p className="text-sm text-ink-faint">No operator tagged.</p>
            ) : (
              <OperatorTable rows={data.operators} />
            )}
          </section>
        </div>
      )}
    </Dialog>
  );
}

/** Tagged operators; `onRemove` adds a remove button per row. */
export function OperatorTable({
  rows,
  onRemove,
}: {
  rows: readonly { employeeId: string; code: string; name: string; designation: string | null; department: string | null }[];
  onRemove?: (employeeId: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-line">
      <table className="w-full text-left text-sm">
        <thead className="bg-accent-soft text-xs text-ink">
          <tr>
            <th scope="col" className="w-12 px-3 py-2 font-medium">
              SL
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Employee Code
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Operator Name
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Designation
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Department
            </th>
            {onRemove && (
              <th scope="col" className="w-20 px-3 py-2 font-medium">
                <span className="sr-only">Remove</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.employeeId} className="border-t border-line">
              <td className="px-3 py-2 text-ink-muted tabular-nums">{index + 1}</td>
              <td className="px-3 py-2 text-ink">{row.code}</td>
              <td className="px-3 py-2 text-ink">{row.name}</td>
              <td className="px-3 py-2 text-ink-muted">{show(row.designation)}</td>
              <td className="px-3 py-2 text-ink-muted">{show(row.department)}</td>
              {onRemove && (
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="ghost" className="text-danger" onClick={() => onRemove(row.employeeId)} aria-label={`Remove ${row.name}`}>
                    Remove
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
