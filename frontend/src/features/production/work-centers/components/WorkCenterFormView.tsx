"use client";

import { ArrowLeft, ChevronDown, Plus, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/form-field";
import { Card, ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { apiFieldErrors, issuesToErrors, numberText, optionalNumber, requiredNumber } from "@/features/sales/lib/form";
import { paths } from "../../paths";
import {
  workCenterInputSchema,
  type MasterKind,
  type Option,
  type WorkCenterDetail,
  type WorkCenterInput,
  type WorkCenterLookups,
} from "../schemas/work-center.schema";
import { createWorkCenter, fetchWorkCenter, fetchWorkCenterLookups, updateWorkCenter } from "../services/work-center.api";
import { MasterDialog, OperatorTable, WithAddNew } from "./WorkCenterParts";

interface Values {
  businessUnitId: string;
  name: string;
  typeId: string;
  code: string;
  standardRunHour: string;
  capacityPerHour: string;
  ratedCapacityPerHour: string;
  costPerHour: string;
  remarks: string;
  departmentId: string;
  departmentSectionId: string;
  warehouseId: string;
  operatorIds: string[];
}

function initialValues(lookups: WorkCenterLookups, record?: WorkCenterDetail): Values {
  return {
    businessUnitId: record?.businessUnitId ?? (lookups.businessUnits.length === 1 ? lookups.businessUnits[0].id : ""),
    name: record?.name ?? "",
    typeId: record?.typeId ?? "",
    code: record?.code ?? "",
    standardRunHour: numberText(record?.standardRunHour),
    capacityPerHour: numberText(record?.capacityPerHour),
    ratedCapacityPerHour: numberText(record?.ratedCapacityPerHour),
    costPerHour: numberText(record?.costPerHour),
    remarks: record?.remarks ?? "",
    departmentId: record?.departmentId ?? "",
    departmentSectionId: record?.departmentSectionId ?? "",
    warehouseId: record?.warehouseId ?? "",
    operatorIds: record?.operators.map((operator) => operator.employeeId) ?? [],
  };
}

function toInput(values: Values): WorkCenterInput {
  return {
    ...(values.businessUnitId ? { businessUnitId: values.businessUnitId } : {}),
    name: values.name,
    typeId: values.typeId,
    code: values.code,
    standardRunHour: requiredNumber(values.standardRunHour),
    capacityPerHour: requiredNumber(values.capacityPerHour),
    ratedCapacityPerHour: requiredNumber(values.ratedCapacityPerHour),
    costPerHour: optionalNumber(values.costPerHour),
    remarks: values.remarks || null,
    departmentId: values.departmentId || null,
    departmentSectionId: values.departmentSectionId || null,
    warehouseId: values.warehouseId || null,
    operatorIds: values.operatorIds,
  };
}

export function NewWorkCenterView() {
  const lookups = useResource("work-center-lookups", fetchWorkCenterLookups);
  if (lookups.error) return <Failed message={errorMessage(lookups.error)} onRetry={lookups.reload} />;
  if (!lookups.data) return <LoadingState />;
  return <WorkCenterForm lookups={lookups.data} />;
}

export function EditWorkCenterView({ id }: { id: string }) {
  const lookups = useResource("work-center-lookups", fetchWorkCenterLookups);
  const record = useResource(`work-center:${id}`, () => fetchWorkCenter(id));
  const error = lookups.error ?? record.error;
  if (error) return <Failed message={errorMessage(error)} onRetry={() => (lookups.reload(), record.reload())} />;
  if (!lookups.data || !record.data) return <LoadingState />;
  return <WorkCenterForm key={record.data.updatedAt} lookups={lookups.data} record={record.data} />;
}

function Failed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <PageContainer className="max-w-none">
      <PageHead title="Work Center" />
      <Card>
        <ErrorState message={message} onRetry={onRetry} />
      </Card>
    </PageContainer>
  );
}

function WorkCenterForm({ lookups: loaded, record }: { lookups: WorkCenterLookups; record?: WorkCenterDetail }) {
  const router = useRouter();
  const toast = useToast();
  const [lookups, setLookups] = useState(loaded);
  const [values, setValues] = useState(() => initialValues(loaded, record));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState<MasterKind | null>(null);
  const [operatorsOpen, setOperatorsOpen] = useState(true);
  const [pickedEmployee, setPickedEmployee] = useState("");

  const set = (patch: Partial<Values>) => setValues((current) => ({ ...current, ...patch }));
  const unit = values.businessUnitId;
  const inUnit = <T extends { businessUnitId: string }>(rows: T[]) => rows.filter((row) => !unit || row.businessUnitId === unit);
  const types = inUnit(lookups.types);
  const departments = inUnit(lookups.departments);
  const sections = lookups.sections.filter((section) => section.departmentId === values.departmentId);
  const warehouses = inUnit(lookups.warehouses);
  const employees = inUnit(lookups.employees);
  const tagged = values.operatorIds.map((employeeId) => {
    const employee = lookups.employees.find((row) => row.id === employeeId);
    const saved = record?.operators.find((row) => row.employeeId === employeeId);
    return {
      employeeId,
      code: employee?.code ?? saved?.code ?? "",
      name: employee?.name ?? saved?.name ?? "Unknown employee",
      designation: employee?.designation ?? saved?.designation ?? null,
      department: employee?.department ?? saved?.department ?? null,
    };
  });
  const available = employees.filter((employee) => !values.operatorIds.includes(employee.id));

  const options = (rows: readonly Option[], placeholder: string) => [{ value: "", label: placeholder }, ...rows.map((row) => ({ value: row.id, label: row.name }))];

  function added(kind: MasterKind, created: Option) {
    setAdding(null);
    if (kind === "types") {
      setLookups((current) => ({ ...current, types: [...current.types, { ...created, businessUnitId: unit }] }));
      set({ typeId: created.id });
    } else if (kind === "departments") {
      setLookups((current) => ({ ...current, departments: [...current.departments, { ...created, businessUnitId: unit }] }));
      set({ departmentId: created.id, departmentSectionId: "" });
    } else {
      setLookups((current) => ({ ...current, sections: [...current.sections, { ...created, departmentId: values.departmentId }] }));
      set({ departmentSectionId: created.id });
    }
  }

  function addOperator() {
    if (!pickedEmployee) return;
    set({ operatorIds: [...values.operatorIds, pickedEmployee] });
    setPickedEmployee("");
  }

  async function save() {
    const input = toInput(values);
    const parsed = workCenterInputSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error));
      toast.error("Please correct the highlighted fields.");
      return;
    }
    if (lookups.businessUnits.length > 1 && !unit) {
      setErrors({ businessUnitId: "Business Unit is required." });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const saved = record ? await updateWorkCenter(record.id, { version: record.updatedAt, data: input }) : await createWorkCenter(input);
      toast.success(`Work center ${saved.code} ${record ? "updated" : "created"}.`);
      router.push(paths.workCenters);
    } catch (error) {
      setErrors(apiFieldErrors(error));
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  const departmentName = lookups.departments.find((department) => department.id === values.departmentId)?.name;

  return (
    <PageContainer className="max-w-none">
      <PageHead
        title={
          <span className="flex items-center gap-2">
            <Link href={paths.workCenters} aria-label="Back to Work Center list" className="rounded-md p-1 text-ink-muted hover:bg-control hover:text-ink">
              <ArrowLeft aria-hidden="true" className="size-5" />
            </Link>
            {record ? "Edit Work Center" : "Work Center"}
          </span>
        }
        actions={
          <Button variant="primary" onClick={save} loading={busy}>
            <Save aria-hidden="true" />
            SAVE
          </Button>
        }
      />
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Card className="p-4">
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            {!record && lookups.businessUnits.length > 1 && (
              <SelectField
                label="Business Unit"
                required
                value={values.businessUnitId}
                error={errors.businessUnitId}
                options={options(lookups.businessUnits, "Business Unit")}
                onChange={(event) =>
                  set({ businessUnitId: event.target.value, typeId: "", departmentId: "", departmentSectionId: "", warehouseId: "", operatorIds: [] })
                }
              />
            )}
            <TextField label="Work Center Name" required maxLength={150} placeholder="Work Center Name" value={values.name} error={errors.name} onChange={(event) => set({ name: event.target.value })} />
            <WithAddNew label="Work Center Type" onAdd={() => setAdding("types")} disabled={!unit}>
              <SelectField label="Work Center Type" required value={values.typeId} error={errors.typeId} options={options(types, "Work Center Type")} onChange={(event) => set({ typeId: event.target.value })} />
            </WithAddNew>
            <TextField label="Work Center Code" required maxLength={30} placeholder="Work Center Code" value={values.code} error={errors.code} onChange={(event) => set({ code: event.target.value })} />
            <TextField
              label="Standard Run Hour (per day)"
              required
              type="number"
              min={0}
              max={24}
              step="any"
              placeholder="Standard Run Hour"
              value={values.standardRunHour}
              error={errors.standardRunHour}
              onChange={(event) => set({ standardRunHour: event.target.value })}
            />
            <TextField
              label="Standard Capacity Per Hour"
              required
              type="number"
              min={0}
              step="any"
              placeholder="Standard Capacity Per Hour"
              value={values.capacityPerHour}
              error={errors.capacityPerHour}
              onChange={(event) => set({ capacityPerHour: event.target.value })}
            />
            <TextField
              label="Rated Capacity Per Hour"
              required
              type="number"
              min={0}
              step="any"
              placeholder="Rated Capacity Per Hour"
              value={values.ratedCapacityPerHour}
              error={errors.ratedCapacityPerHour}
              onChange={(event) => set({ ratedCapacityPerHour: event.target.value })}
            />
            <TextField
              label="Cost Per Hour"
              type="number"
              min={0}
              step="any"
              placeholder="Cost Per Hour"
              value={values.costPerHour}
              error={errors.costPerHour}
              onChange={(event) => set({ costPerHour: event.target.value })}
            />
            <TextField label="Remarks" maxLength={500} placeholder="Remarks" value={values.remarks} error={errors.remarks} onChange={(event) => set({ remarks: event.target.value })} />
            <WithAddNew label="Department" onAdd={() => setAdding("departments")} disabled={!unit}>
              <SelectField
                label="Department"
                value={values.departmentId}
                error={errors.departmentId}
                options={options(departments, "Department")}
                onChange={(event) => set({ departmentId: event.target.value, departmentSectionId: "" })}
              />
            </WithAddNew>
            <WithAddNew label="Department Section" onAdd={() => setAdding("sections")} disabled={!values.departmentId}>
              <SelectField
                label="Department Section"
                value={values.departmentSectionId}
                error={errors.departmentSectionId}
                disabled={!values.departmentId}
                hint={values.departmentId ? undefined : "Choose a department first."}
                options={options(sections, "Department Section")}
                onChange={(event) => set({ departmentSectionId: event.target.value })}
              />
            </WithAddNew>
            <SelectField
              label="Warehouse"
              value={values.warehouseId}
              error={errors.warehouseId}
              options={[{ value: "", label: "Warehouse" }, ...warehouses.map((warehouse) => ({ value: warehouse.id, label: `${warehouse.name} (${warehouse.officeName})` }))]}
              onChange={(event) => set({ warehouseId: event.target.value })}
            />
          </div>
        </Card>

        <Card className="p-4">
          <section aria-labelledby="operator-info" className="rounded-md border border-line">
            <header className="flex items-center justify-between gap-3 px-4 py-3">
              <h2 id="operator-info" className="text-lg font-semibold text-ink">
                Operator Information
                {values.operatorIds.length > 0 && <span className="ml-2 text-sm font-normal text-ink-faint">({values.operatorIds.length} tagged)</span>}
              </h2>
              <Button size="sm" variant="ghost" aria-expanded={operatorsOpen} aria-controls="operator-body" onClick={() => setOperatorsOpen((open) => !open)}>
                View Details
                <ChevronDown aria-hidden="true" className={cn("transition-transform", operatorsOpen && "rotate-180")} />
              </Button>
            </header>
            {operatorsOpen && (
              <div id="operator-body" className="flex flex-col gap-3 border-t border-line p-4">
                <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,24rem)_auto]">
                  <SelectField
                    label="Operator (Employee)"
                    value={pickedEmployee}
                    error={errors.operatorIds}
                    hint={employees.length === 0 ? "No active employee in this business unit." : undefined}
                    options={[
                      { value: "", label: available.length ? "Choose an employee" : "No more employees" },
                      ...available.map((employee) => ({
                        value: employee.id,
                        label: `${employee.code} - ${employee.name}${employee.designation ? ` (${employee.designation})` : ""}`,
                      })),
                    ]}
                    onChange={(event) => setPickedEmployee(event.target.value)}
                  />
                  <Button variant="accent-soft" onClick={addOperator} disabled={!pickedEmployee}>
                    <Plus aria-hidden="true" />
                    Add Operator
                  </Button>
                </div>
                {tagged.length === 0 ? (
                  <p className="text-sm text-ink-faint">No operator tagged yet.</p>
                ) : (
                  <OperatorTable rows={tagged} onRemove={(employeeId) => set({ operatorIds: values.operatorIds.filter((id) => id !== employeeId) })} />
                )}
              </div>
            )}
          </section>
        </Card>
      </form>
      <MasterDialog
        kind={adding}
        businessUnitId={unit || undefined}
        departmentId={values.departmentId || undefined}
        departmentName={departmentName}
        onClose={() => setAdding(null)}
        onCreated={added}
      />
    </PageContainer>
  );
}
