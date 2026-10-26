"use client";

import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { CheckboxField, CONTROL, SelectField, TextField } from "@/components/ui/form-field";
import { Card, ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { ITEM_TYPES } from "@/features/configuration/entity-master-data/item/schemas/item.schema";
import { issuesToErrors } from "@/features/sales/lib/form";
import { MasterDialog, WithAddNew } from "@/features/production/work-centers/components/WorkCenterParts";
import type { MasterKind, Option } from "@/features/production/work-centers/schemas/work-center.schema";
import { paths } from "../../paths";
import { altQty, bomTotals, materialAmount, overheadAmount, outputWeight, totalQty, wastageQty } from "../lib/bom-totals";
import {
  OUTPUT_TYPE_LABELS,
  OUTPUT_TYPES,
  WASTAGE_TYPE_LABELS,
  WASTAGE_TYPES,
  bomInputSchema,
  type BomDetail,
  type BomInput,
  type BomItemOption,
  type BomLookups,
  type BomType,
  type OutputType,
  type WastageType,
} from "../schemas/bom.schema";
import { createBom, deleteBom, fetchBom, fetchBomLookups, updateBom } from "../services/bom.api";
import { LineTable, money, qty } from "./BomDialogs";

// ─── Drafts (number fields stay text while typing) ───────────────────────────

interface OutputDraft {
  itemId: string;
  outputType: OutputType;
  netWeight: string;
  lotSizeQty: string;
  costPercent: string;
}

interface MaterialDraft {
  itemId: string;
  materialType: string;
  excludeFromScrap: boolean;
  qty: string;
  wastagePercent: string;
  rate: string;
}

interface WastageDraft {
  itemId: string;
  itemType: string;
  outputType: WastageType;
  ratioPercent: string;
  isMandatory: boolean;
  calcWithNetWeight: boolean;
  calcWithProcessRunner: boolean;
}

interface OverheadDraft {
  accountId: string;
  /** "" = fixed amount. */
  percentage: string;
  amount: string;
}

interface Values {
  businessUnitId: string;
  bomType: BomType;
  name: string;
  departmentId: string;
  departmentSectionId: string;
  tolerancePercent: string;
  remarks: string;
  outputs: OutputDraft[];
  materials: MaterialDraft[];
  wastages: WastageDraft[];
  overheads: OverheadDraft[];
}

const text = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));
/** Text → number; "" and junk count as 0 for live totals (validation reports them on save). */
const n = (value: string) => {
  const parsed = Number(value);
  return value.trim() === "" || !Number.isFinite(parsed) ? 0 : parsed;
};
const strict = (value: string) => (value.trim() === "" ? Number.NaN : Number(value));

function initialValues(lookups: BomLookups, record?: BomDetail, copy?: boolean): Values {
  return {
    businessUnitId: record?.businessUnitId ?? (lookups.businessUnits.length === 1 ? lookups.businessUnits[0].id : ""),
    bomType: record?.bomType ?? "SINGLE_OUTPUT",
    name: record ? (copy ? `${record.name} (Copy)` : record.name) : "",
    departmentId: record?.departmentId ?? "",
    departmentSectionId: record?.departmentSectionId ?? "",
    tolerancePercent: text(record?.tolerancePercent),
    remarks: record?.remarks ?? "",
    outputs:
      record?.outputLines.map((line) => ({
        itemId: line.itemId,
        outputType: line.outputType,
        netWeight: text(line.netWeight),
        lotSizeQty: text(line.lotSizeQty),
        costPercent: text(line.costPercent),
      })) ?? [],
    materials:
      record?.materials.map((line) => ({
        itemId: line.itemId,
        materialType: line.materialType ?? "",
        excludeFromScrap: line.excludeFromScrap,
        qty: text(line.qty),
        wastagePercent: text(line.wastagePercent),
        rate: text(line.rate),
      })) ?? [],
    wastages:
      record?.wastages.map((line) => ({
        itemId: line.itemId,
        itemType: line.itemType ?? "",
        outputType: line.outputType,
        ratioPercent: text(line.ratioPercent),
        isMandatory: line.isMandatory,
        calcWithNetWeight: line.calcWithNetWeight,
        calcWithProcessRunner: line.calcWithProcessRunner,
      })) ?? [],
    overheads: record?.overheads.map((line) => ({ accountId: line.accountId, percentage: text(line.percentage), amount: text(line.amount) })) ?? [],
  };
}

function toInput(values: Values): BomInput {
  return {
    ...(values.businessUnitId ? { businessUnitId: values.businessUnitId } : {}),
    name: values.name,
    bomType: values.bomType,
    departmentId: values.departmentId || null,
    departmentSectionId: values.departmentSectionId || null,
    tolerancePercent: values.tolerancePercent.trim() === "" ? null : Number(values.tolerancePercent),
    remarks: values.remarks || null,
    outputs: values.outputs.map((line) => ({
      itemId: line.itemId,
      outputType: line.outputType,
      netWeight: line.netWeight.trim() === "" ? 0 : Number(line.netWeight),
      lotSizeQty: strict(line.lotSizeQty),
      costPercent: strict(line.costPercent),
    })),
    materials: values.materials.map((line) => ({
      itemId: line.itemId,
      materialType: line.materialType || null,
      excludeFromScrap: line.excludeFromScrap,
      qty: strict(line.qty),
      wastagePercent: line.wastagePercent.trim() === "" ? 0 : Number(line.wastagePercent),
      rate: line.rate.trim() === "" ? 0 : Number(line.rate),
    })),
    wastages: values.wastages.map((line) => ({
      itemId: line.itemId,
      itemType: line.itemType || null,
      outputType: line.outputType,
      ratioPercent: strict(line.ratioPercent),
      isMandatory: line.isMandatory,
      calcWithNetWeight: line.calcWithNetWeight,
      calcWithProcessRunner: line.calcWithProcessRunner,
    })),
    overheads: values.overheads.map((line) => ({
      accountId: line.accountId,
      percentage: line.percentage.trim() === "" ? null : Number(line.percentage),
      amount: line.percentage.trim() === "" ? strict(line.amount) : 0,
    })),
  };
}

// ─── Entry points ────────────────────────────────────────────────────────────

/** /production/bill-of-materials/new[?copy=<bomId>] — read the search params inside <Suspense>. */
export function NewBomView() {
  const copyId = useSearchParams().get("copy");
  const lookups = useResource("bom-lookups", fetchBomLookups);
  const source = useResource(copyId ? `bom:${copyId}` : null, () => fetchBom(copyId!));
  const error = lookups.error ?? source.error;
  if (error) return <Failed message={errorMessage(error)} onRetry={() => (lookups.reload(), source.reload())} />;
  if (!lookups.data || (copyId && !source.data)) return <LoadingState />;
  return <BomForm key={copyId ?? "new"} lookups={lookups.data} source={source.data} copy={!!copyId} />;
}

export function EditBomView({ id }: { id: string }) {
  const lookups = useResource("bom-lookups", fetchBomLookups);
  const record = useResource(`bom:${id}`, () => fetchBom(id));
  const error = lookups.error ?? record.error;
  if (error) return <Failed message={errorMessage(error)} onRetry={() => (lookups.reload(), record.reload())} />;
  if (!lookups.data || !record.data) return <LoadingState />;
  return <BomForm key={record.data.updatedAt} lookups={lookups.data} source={record.data} />;
}

function Failed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <PageContainer className="max-w-none">
      <PageHead title="Bill Of Material" />
      <Card>
        <ErrorState message={message} onRetry={onRetry} />
      </Card>
    </PageContainer>
  );
}

// ─── Item picker (Item Type → Category → Sub Category → Item) ────────────────

interface PickerState {
  itemType: string;
  categoryId: string;
  subCategoryId: string;
  itemId: string;
}

const EMPTY_PICKER: PickerState = { itemType: "", categoryId: "", subCategoryId: "", itemId: "" };
const itemLabel = (item: BomItemOption) => `${item.code} - ${item.name} (${item.uom})`;

function ItemPicker({
  lookups,
  items,
  value,
  onChange,
  itemLabelText,
  error,
}: {
  lookups: BomLookups;
  items: BomItemOption[];
  value: PickerState;
  onChange: (next: PickerState) => void;
  itemLabelText: string;
  error?: string;
}) {
  const categories = lookups.categories.filter((category) => category.level === 1);
  const subCategories = lookups.categories.filter((category) => category.level === 2 && category.parentId === value.categoryId);
  const matching = items.filter(
    (item) =>
      (!value.itemType || item.itemType === value.itemType) &&
      (!value.categoryId || item.categoryId === value.categoryId) &&
      (!value.subCategoryId || item.subCategoryId === value.subCategoryId),
  );
  return (
    <>
      <SelectField
        label="Item Type"
        value={value.itemType}
        options={[{ value: "", label: "All" }, ...ITEM_TYPES.map((type) => ({ value: type, label: type }))]}
        onChange={(event) => onChange({ ...value, itemType: event.target.value, itemId: "" })}
      />
      <SelectField
        label="Category"
        value={value.categoryId}
        options={[{ value: "", label: "All" }, ...categories.map((category) => ({ value: category.id, label: category.name }))]}
        onChange={(event) => onChange({ ...value, categoryId: event.target.value, subCategoryId: "", itemId: "" })}
      />
      <SelectField
        label="Sub Category"
        value={value.subCategoryId}
        disabled={!value.categoryId || subCategories.length === 0}
        options={[{ value: "", label: "All" }, ...subCategories.map((category) => ({ value: category.id, label: category.name }))]}
        onChange={(event) => onChange({ ...value, subCategoryId: event.target.value, itemId: "" })}
      />
      <SelectField
        label={itemLabelText}
        required
        value={value.itemId}
        error={error}
        hint={`${matching.length} item${matching.length === 1 ? "" : "s"}`}
        options={[{ value: "", label: matching.length ? `Choose (${matching.length})` : "No item matches" }, ...matching.map((item) => ({ value: item.id, label: itemLabel(item) }))]}
        onChange={(event) => onChange({ ...value, itemId: event.target.value })}
      />
    </>
  );
}

/** Number input inside a line table. */
function CellInput({ label, value, onChange, invalid, className }: { label: string; value: string; onChange: (value: string) => void; invalid?: boolean; className?: string }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step="any"
      min={0}
      aria-label={label}
      aria-invalid={invalid || undefined}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(CONTROL, "h-7 w-24 text-right tabular-nums", invalid && "ring-1 ring-danger", className)}
    />
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button size="icon" variant="ghost" className="text-danger" aria-label={label} onClick={onClick}>
      <Trash2 aria-hidden="true" />
    </Button>
  );
}

function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-semibold text-ink">{children}</h2>
      {right}
    </div>
  );
}

type Tab = "materials" | "wastage" | "overhead";

// ─── Form ────────────────────────────────────────────────────────────────────

function BomForm({ lookups: loaded, source, copy }: { lookups: BomLookups; source?: BomDetail; copy?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const record = copy ? undefined : source;
  const [lookups, setLookups] = useState(loaded);
  const [values, setValues] = useState(() => initialValues(loaded, source, copy));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState<MasterKind | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState<Tab>("materials");

  const [outputPicker, setOutputPicker] = useState<PickerState>(EMPTY_PICKER);
  const [outputEntry, setOutputEntry] = useState({ outputType: "FINISHED_GOODS" as OutputType, netWeight: "", lotSizeQty: "" });
  const [materialPicker, setMaterialPicker] = useState<PickerState>(EMPTY_PICKER);
  const [materialEntry, setMaterialEntry] = useState({ qty: "", wastagePercent: "", rate: "", excludeFromScrap: false });
  const [wastagePicker, setWastagePicker] = useState<PickerState>(EMPTY_PICKER);
  const [wastageEntry, setWastageEntry] = useState({
    outputType: "SCRAP" as WastageType,
    ratioPercent: "",
    isMandatory: false,
    calcWithNetWeight: false,
    calcWithProcessRunner: false,
  });
  const [overheadEntry, setOverheadEntry] = useState({ accountId: "", mode: "percentage" as "percentage" | "amount", value: "" });
  const [entryError, setEntryError] = useState<Record<string, string>>({});

  const set = (patch: Partial<Values>) => setValues((current) => ({ ...current, ...patch }));
  const unit = values.businessUnitId;
  const items = lookups.items.filter((item) => !unit || item.businessUnitId === unit);
  const itemById = new Map(lookups.items.map((item) => [item.id, item]));
  const departments = lookups.departments.filter((department) => !unit || department.businessUnitId === unit);
  const sections = lookups.sections.filter((section) => section.departmentId === values.departmentId);

  const totals = bomTotals(
    values.materials.map((line) => ({ qty: n(line.qty), wastagePercent: n(line.wastagePercent), rate: n(line.rate) })),
    values.overheads.map((line) => ({ amount: n(line.amount), percentage: line.percentage.trim() === "" ? null : n(line.percentage) })),
    values.outputs.map((line) => ({ lotSizeQty: n(line.lotSizeQty), netWeight: n(line.netWeight) })),
  );
  const accountById = new Map(lookups.accounts.map((account) => [account.id, account]));
  const costShare = values.outputs.reduce((sum, line) => sum + n(line.costPercent), 0);
  const single = values.bomType === "SINGLE_OUTPUT";
  const usedIds = new Set([...values.outputs, ...values.materials, ...values.wastages].map((line) => line.itemId));

  const pickedMaterial = itemById.get(materialPicker.itemId);

  function updateLine<K extends "outputs" | "materials" | "wastages" | "overheads">(key: K, index: number, patch: Partial<Values[K][number]>) {
    setValues((current) => ({ ...current, [key]: current[key].map((line, at) => (at === index ? { ...line, ...patch } : line)) }));
  }
  function removeLine(key: "outputs" | "materials" | "wastages" | "overheads", index: number) {
    setValues((current) => ({ ...current, [key]: current[key].filter((_, at) => at !== index) }));
  }

  function addOutput() {
    const errs: Record<string, string> = {};
    if (!outputPicker.itemId) errs.outputItem = "Choose the FG/SFG item.";
    else if (usedIds.has(outputPicker.itemId)) errs.outputItem = "This item is already in the BOM.";
    if (!(n(outputEntry.lotSizeQty) > 0)) errs.outputLot = "Lot Size must be more than 0.";
    if (outputEntry.netWeight && n(outputEntry.netWeight) < 0) errs.outputWeight = "Net Weight cannot be negative.";
    if (single && values.outputs.length >= 1) errs.outputItem = "A single output BOM has one production item. Choose Multiple Output to add more.";
    setEntryError(errs);
    if (Object.keys(errs).length) return;
    const item = itemById.get(outputPicker.itemId);
    const remaining = Math.max(Math.round((100 - costShare) * 100) / 100, 0);
    set({
      outputs: [
        ...values.outputs,
        {
          itemId: outputPicker.itemId,
          outputType: outputEntry.outputType,
          netWeight: outputEntry.netWeight || text(item?.netWeight),
          lotSizeQty: outputEntry.lotSizeQty,
          costPercent: String(values.outputs.length === 0 ? 100 : remaining),
        },
      ],
    });
    setOutputPicker({ ...outputPicker, itemId: "" });
    setOutputEntry({ ...outputEntry, netWeight: "", lotSizeQty: "" });
  }

  function addMaterial() {
    const errs: Record<string, string> = {};
    if (!materialPicker.itemId) errs.materialItem = "Choose the material item.";
    else if (usedIds.has(materialPicker.itemId)) errs.materialItem = "This item is already in the BOM.";
    if (!(n(materialEntry.qty) > 0)) errs.materialQty = "Quantity must be more than 0.";
    const wastage = n(materialEntry.wastagePercent);
    if (wastage < 0 || wastage >= 100) errs.materialWastage = "Wastage must be 0 to below 100%.";
    if (n(materialEntry.rate) < 0) errs.materialRate = "Rate cannot be negative.";
    setEntryError(errs);
    if (Object.keys(errs).length) return;
    const item = itemById.get(materialPicker.itemId);
    set({
      materials: [
        ...values.materials,
        {
          itemId: materialPicker.itemId,
          materialType: materialPicker.itemType || item?.itemType || "",
          excludeFromScrap: materialEntry.excludeFromScrap,
          qty: materialEntry.qty,
          wastagePercent: materialEntry.wastagePercent || "0",
          rate: materialEntry.rate || text(item?.avgRate) || "0",
        },
      ],
    });
    setMaterialPicker({ ...materialPicker, itemId: "" });
    setMaterialEntry({ qty: "", wastagePercent: "", rate: "", excludeFromScrap: false });
  }

  function addWastage() {
    const errs: Record<string, string> = {};
    if (!wastagePicker.itemId) errs.wastageItem = "Choose the wastage / by-product item.";
    else if (usedIds.has(wastagePicker.itemId)) errs.wastageItem = "This item is already in the BOM.";
    const ratio = n(wastageEntry.ratioPercent);
    if (!(ratio > 0) || ratio > 100) errs.wastageRatio = "Ratio Qty (%) must be more than 0 and at most 100.";
    setEntryError(errs);
    if (Object.keys(errs).length) return;
    const item = itemById.get(wastagePicker.itemId);
    set({
      wastages: [
        ...values.wastages,
        {
          itemId: wastagePicker.itemId,
          itemType: wastagePicker.itemType || item?.itemType || "",
          outputType: wastageEntry.outputType,
          ratioPercent: wastageEntry.ratioPercent,
          isMandatory: wastageEntry.isMandatory,
          calcWithNetWeight: wastageEntry.calcWithNetWeight,
          calcWithProcessRunner: wastageEntry.calcWithProcessRunner,
        },
      ],
    });
    setWastagePicker({ ...wastagePicker, itemId: "" });
    setWastageEntry({ ...wastageEntry, ratioPercent: "", isMandatory: false, calcWithNetWeight: false, calcWithProcessRunner: false });
  }

  function addOverhead() {
    const errs: Record<string, string> = {};
    if (!overheadEntry.accountId) errs.overheadAccount = "Choose the overhead account.";
    else if (values.overheads.some((line) => line.accountId === overheadEntry.accountId)) errs.overheadAccount = "This account is already added.";
    const value = n(overheadEntry.value);
    if (overheadEntry.mode === "percentage" && (!(value > 0) || value > 1000)) errs.overheadValue = "Percentage must be more than 0.";
    if (overheadEntry.mode === "amount" && !(value > 0)) errs.overheadValue = "Amount must be more than 0.";
    setEntryError(errs);
    if (Object.keys(errs).length) return;
    set({
      overheads: [
        ...values.overheads,
        overheadEntry.mode === "percentage"
          ? { accountId: overheadEntry.accountId, percentage: overheadEntry.value, amount: "" }
          : { accountId: overheadEntry.accountId, percentage: "", amount: overheadEntry.value },
      ],
    });
    setOverheadEntry({ ...overheadEntry, accountId: "", value: "" });
  }

  function added(kind: MasterKind, created: Option, departmentId?: string) {
    setAdding(null);
    if (kind === "departments") {
      setLookups((current) => ({ ...current, departments: [...current.departments, { ...created, businessUnitId: unit }] }));
      set({ departmentId: created.id, departmentSectionId: "" });
    } else if (kind === "sections" && departmentId) {
      setLookups((current) => ({ ...current, sections: [...current.sections, { ...created, departmentId }] }));
      set({ departmentId, departmentSectionId: created.id });
    }
  }

  async function save() {
    const input = toInput(values);
    const parsed = bomInputSchema.safeParse(input);
    if (!parsed.success) {
      const errs = issuesToErrors(parsed.error);
      setErrors(errs);
      if (Object.keys(errs).some((key) => key.startsWith("materials"))) setTab("materials");
      else if (Object.keys(errs).some((key) => key.startsWith("wastages"))) setTab("wastage");
      else if (Object.keys(errs).some((key) => key.startsWith("overheads"))) setTab("overhead");
      toast.error(parsed.error.issues[0]?.message ?? "Please correct the highlighted fields.");
      return;
    }
    if (lookups.businessUnits.length > 1 && !unit) {
      setErrors({ businessUnitId: "Business Unit is required." });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const saved = record ? await updateBom(record.id, { version: record.updatedAt, data: input }) : await createBom(input);
      toast.success(`Bill of material ${saved.name} ${record ? "updated" : "created"}.`);
      router.push(paths.billOfMaterials);
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  async function remove() {
    if (!record) return;
    setBusy(true);
    try {
      await deleteBom(record.id, record.updatedAt);
      toast.success(`Bill of material ${record.name} deleted.`);
      router.push(paths.billOfMaterials);
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
      setDeleting(false);
    }
  }

  const lineError = (prefix: string, index: number, field: string) => errors[`${prefix}.${index}.${field}`];
  const title = record ? "Edit Bill Of Material" : copy ? "Copy Bill Of Material" : "Create Bill Of Material";

  return (
    <PageContainer className="max-w-none">
      <PageHead
        title={
          <span className="flex items-center gap-2">
            <Link href={paths.billOfMaterials} aria-label="Back to Bill Of Material list" className="rounded-md p-1 text-ink-muted hover:bg-control hover:text-ink">
              <ArrowLeft aria-hidden="true" className="size-5" />
            </Link>
            {title}
          </span>
        }
        subtitle={copy && source ? `Copied from ${source.name}` : undefined}
        actions={
          <>
            {record && (
              <Button variant="ghost" className="text-danger" onClick={() => setDeleting(true)} disabled={busy}>
                <Trash2 aria-hidden="true" />
                Delete
              </Button>
            )}
            <Button variant="primary" onClick={save} loading={busy}>
              <Save aria-hidden="true" />
              SAVE
            </Button>
          </>
        }
      />
      <div className="flex flex-col gap-4">
        {/* Header */}
        <Card className="flex flex-col gap-4 p-4">
          <fieldset className="flex flex-wrap items-center gap-5">
            <legend className="sr-only">BOM type</legend>
            {(["SINGLE_OUTPUT", "MULTIPLE_OUTPUT"] as const).map((type) => (
              <label key={type} className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink">
                <input
                  type="radio"
                  name="bomType"
                  value={type}
                  checked={values.bomType === type}
                  onChange={() => set({ bomType: type })}
                  className="size-4 accent-(--accent-strong)"
                />
                {type === "SINGLE_OUTPUT" ? "Single Output" : "Multiple Output"}
              </label>
            ))}
          </fieldset>
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            {!record && lookups.businessUnits.length > 1 && (
              <SelectField
                label="Business Unit"
                required
                value={values.businessUnitId}
                error={errors.businessUnitId}
                options={[{ value: "", label: "Business Unit" }, ...lookups.businessUnits.map((bu) => ({ value: bu.id, label: bu.name }))]}
                onChange={(event) => set({ businessUnitId: event.target.value, departmentId: "", departmentSectionId: "", outputs: [], materials: [], wastages: [] })}
              />
            )}
            <TextField
              label="BOM Name"
              required
              maxLength={150}
              placeholder="BOM Name"
              value={values.name}
              error={errors.name}
              onChange={(event) => {
                set({ name: event.target.value });
                if (errors.name && event.target.value.trim()) setErrors(({ name: _drop, ...rest }) => rest);
              }}
              onBlur={() => !values.name.trim() && setErrors((current) => ({ ...current, name: "BoM Name is required." }))}
            />
            <WithAddNew label="Department" onAdd={() => setAdding("departments")} disabled={!unit}>
              <SelectField
                label="Department"
                value={values.departmentId}
                error={errors.departmentId}
                options={[{ value: "", label: "Department" }, ...departments.map((department) => ({ value: department.id, label: department.name }))]}
                onChange={(event) => set({ departmentId: event.target.value, departmentSectionId: "" })}
              />
            </WithAddNew>
            <WithAddNew label="Section" onAdd={() => setAdding("sections")} disabled={!unit}>
              <SelectField
                label="Section"
                value={values.departmentSectionId}
                disabled={!values.departmentId}
                hint={values.departmentId ? undefined : "Choose a department first."}
                options={[{ value: "", label: "Section" }, ...sections.map((section) => ({ value: section.id, label: section.name }))]}
                onChange={(event) => set({ departmentSectionId: event.target.value })}
              />
            </WithAddNew>
            <TextField label="Remarks" maxLength={500} placeholder="Remarks" value={values.remarks} onChange={(event) => set({ remarks: event.target.value })} />
          </div>
        </Card>

        {/* Production items */}
        <Card className="flex flex-col gap-4 p-4">
          <SectionTitle right={<span className="text-sm text-ink-muted">Lot size: <strong className="text-ink">{qty(totals.lotSize)}</strong></span>}>
            Production Item Information
          </SectionTitle>
          <div className="grid items-start gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <ItemPicker
              lookups={lookups}
              items={items}
              value={outputPicker}
              onChange={setOutputPicker}
              itemLabelText="FG/SFG Item"
              error={entryError.outputItem}
            />
            <SelectField
              label="Output Type"
              value={outputEntry.outputType}
              options={OUTPUT_TYPES.map((type) => ({ value: type, label: OUTPUT_TYPE_LABELS[type] }))}
              onChange={(event) => setOutputEntry({ ...outputEntry, outputType: event.target.value as OutputType })}
            />
            <TextField
              label="Net Weight"
              type="number"
              min={0}
              step="any"
              placeholder={text(itemById.get(outputPicker.itemId)?.netWeight) || "Net Weight"}
              value={outputEntry.netWeight}
              error={entryError.outputWeight}
              onChange={(event) => setOutputEntry({ ...outputEntry, netWeight: event.target.value })}
            />
            <TextField
              label="Lot Size"
              required
              type="number"
              min={0}
              step="any"
              placeholder="Lot Size"
              value={outputEntry.lotSizeQty}
              error={entryError.outputLot}
              onChange={(event) => setOutputEntry({ ...outputEntry, lotSizeQty: event.target.value })}
            />
            <div className="grid grid-cols-[1fr_auto] items-start gap-3">
              <TextField
                label="Tolerance (%)"
                type="number"
                min={0}
                max={100}
                step="any"
                placeholder="Tolerance"
                value={values.tolerancePercent}
                error={errors.tolerancePercent}
                onChange={(event) => set({ tolerancePercent: event.target.value })}
              />
              <Button variant="accent-soft" className="mt-5" onClick={addOutput}>
                <Plus aria-hidden="true" />
                Add
              </Button>
            </div>
          </div>
          {errors.outputs && (
            <p role="alert" className="text-sm text-danger">
              {errors.outputs}
            </p>
          )}
          <LineTable
            columns={[
              { header: "SL", className: "w-12" },
              { header: "Item" },
              { header: "Item Type" },
              { header: "Net Weight", align: "right" },
              { header: "Lot Size/Quantity", align: "right" },
              { header: "Total Weight", align: "right" },
              { header: "Cost Percentage", align: "right" },
              { header: "Remove", align: "center", className: "w-16" },
            ]}
            rows={values.outputs.map((line, index) => {
              const item = itemById.get(line.itemId);
              return [
                index + 1,
                <span key="item" className="text-ink">{item ? itemLabel(item) : (source?.outputLines.find((row) => row.itemId === line.itemId)?.name ?? "Unknown item")}</span>,
                <select
                  key="type"
                  aria-label="Item type"
                  value={line.outputType}
                  onChange={(event) => updateLine("outputs", index, { outputType: event.target.value as OutputType })}
                  className={cn(CONTROL, "h-7 w-40")}
                >
                  {OUTPUT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {OUTPUT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>,
                <CellInput key="w" label="Net weight" value={line.netWeight} invalid={!!lineError("outputs", index, "netWeight")} onChange={(value) => updateLine("outputs", index, { netWeight: value })} />,
                <CellInput key="l" label="Lot size" value={line.lotSizeQty} invalid={!!lineError("outputs", index, "lotSizeQty")} onChange={(value) => updateLine("outputs", index, { lotSizeQty: value })} />,
                qty(outputWeight(n(line.netWeight), n(line.lotSizeQty))),
                <CellInput key="c" label="Cost percentage" value={line.costPercent} invalid={!!lineError("outputs", index, "costPercent")} onChange={(value) => updateLine("outputs", index, { costPercent: value })} />,
                <RemoveButton key="x" label={`Remove ${item?.name ?? "item"}`} onClick={() => removeLine("outputs", index)} />,
              ];
            })}
            footer={
              values.outputs.length > 1
                ? [["", "Total", "", "", qty(totals.lotSize), "", <span key="share" className={Math.abs(costShare - 100) > 0.01 ? "text-danger" : undefined}>{qty(costShare)}%</span>, ""]]
                : []
            }
            empty="Add the finished / semi-finished item this BOM produces."
          />
        </Card>

        {/* Inputs */}
        <Card>
          <Tabs<Tab>
            label="BOM setup"
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "materials", label: "Input Materials Setup", badge: values.materials.length || undefined },
              { id: "wastage", label: "Other/Wastage Output Setup", badge: values.wastages.length || undefined },
              { id: "overhead", label: "Overhead Setup", badge: values.overheads.length || undefined },
            ]}
          >
            <div className="flex flex-col gap-4 p-4">
              {tab === "materials" && (
                <>
                  <div className="grid items-start gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                    <ItemPicker
                      lookups={lookups}
                      items={items}
                      value={materialPicker}
                      onChange={(next) => {
                        setMaterialPicker(next);
                        if (next.itemId !== materialPicker.itemId) setMaterialEntry((entry) => ({ ...entry, rate: text(itemById.get(next.itemId)?.avgRate) }));
                      }}
                      itemLabelText="Material Item"
                      error={entryError.materialItem}
                    />
                    <TextField
                      label="Quantity"
                      required
                      type="number"
                      min={0}
                      step="any"
                      placeholder={pickedMaterial ? `Quantity (${pickedMaterial.uom})` : "Quantity"}
                      value={materialEntry.qty}
                      error={entryError.materialQty}
                      hint={pickedMaterial ? `Stock: ${qty(pickedMaterial.stock)} ${pickedMaterial.uom}` : undefined}
                      onChange={(event) => setMaterialEntry({ ...materialEntry, qty: event.target.value })}
                    />
                    <TextField
                      label="Wastage (%)"
                      type="number"
                      min={0}
                      max={99.99}
                      step="any"
                      placeholder="0.00"
                      value={materialEntry.wastagePercent}
                      error={entryError.materialWastage}
                      onChange={(event) => setMaterialEntry({ ...materialEntry, wastagePercent: event.target.value })}
                    />
                    <TextField
                      label="Avg. Rate"
                      type="number"
                      min={0}
                      step="any"
                      placeholder="0.00"
                      value={materialEntry.rate}
                      error={entryError.materialRate}
                      hint={pickedMaterial ? (pickedMaterial.avgRate ? "From purchase history; you can change it." : "No purchase rate yet; enter it.") : undefined}
                      onChange={(event) => setMaterialEntry({ ...materialEntry, rate: event.target.value })}
                    />
                    <div className="flex items-end justify-between gap-3 sm:col-span-2 lg:col-span-1 lg:mt-5">
                      <CheckboxField
                        label="Exclude From Scrap"
                        checked={materialEntry.excludeFromScrap}
                        onChange={(event) => setMaterialEntry({ ...materialEntry, excludeFromScrap: event.target.checked })}
                      />
                      <Button variant="accent-soft" onClick={addMaterial}>
                        <Plus aria-hidden="true" />
                        Add
                      </Button>
                    </div>
                  </div>
                  {errors.materials && (
                    <p role="alert" className="text-sm text-danger">
                      {errors.materials}
                    </p>
                  )}
                  <SectionTitle right={<span className="text-sm font-semibold text-ink">Material Total : {money(totals.materialCost)}</span>}>Input Materials</SectionTitle>
                  <LineTable
                    columns={[
                      { header: "SL", className: "w-12" },
                      { header: "Materials" },
                      { header: "Type" },
                      { header: "Excl. Scrap", align: "center" },
                      { header: "Alt. Qty", align: "right" },
                      { header: "Quantity", align: "right" },
                      { header: "Wastage (%)", align: "right" },
                      { header: "Total Quantity", align: "right" },
                      { header: "Avg. Rate", align: "right" },
                      { header: "Total", align: "right" },
                      { header: "Remove", align: "center", className: "w-16" },
                    ]}
                    rows={values.materials.map((line, index) => {
                      const item = itemById.get(line.itemId);
                      const alt = item?.altUom ? altQty(n(line.qty), item.altUomFactor) : null;
                      return [
                        index + 1,
                        <span key="item" className="text-ink">{item ? itemLabel(item) : (source?.materials.find((row) => row.itemId === line.itemId)?.name ?? "Unknown item")}</span>,
                        line.materialType || "—",
                        <input
                          key="scrap"
                          type="checkbox"
                          aria-label="Exclude from scrap"
                          checked={line.excludeFromScrap}
                          onChange={(event) => updateLine("materials", index, { excludeFromScrap: event.target.checked })}
                          className="size-4 accent-(--accent-strong)"
                        />,
                        alt === null ? "—" : `${qty(alt)} ${item?.altUom ?? ""}`,
                        <CellInput key="q" label="Quantity" value={line.qty} invalid={!!lineError("materials", index, "qty")} onChange={(value) => updateLine("materials", index, { qty: value })} />,
                        <CellInput key="w" label="Wastage" className="w-20" value={line.wastagePercent} invalid={!!lineError("materials", index, "wastagePercent")} onChange={(value) => updateLine("materials", index, { wastagePercent: value })} />,
                        qty(totalQty(n(line.qty), n(line.wastagePercent))),
                        <CellInput key="r" label="Avg. rate" value={line.rate} invalid={!!lineError("materials", index, "rate")} onChange={(value) => updateLine("materials", index, { rate: value })} />,
                        <span key="t" className="font-medium text-ink">{money(materialAmount(n(line.qty), n(line.wastagePercent), n(line.rate)))}</span>,
                        <RemoveButton key="x" label={`Remove ${item?.name ?? "material"}`} onClick={() => removeLine("materials", index)} />,
                      ];
                    })}
                    footer={
                      values.materials.length
                        ? [
                            ["", "Total Of Raw Material", "", "", "", qty(totals.materialQty), "", qty(totals.materialTotalQty), "", money(totals.materialCost), ""],
                            ...(totals.overheadCost ? [["", "Overhead", "", "", "", "", "", "", "", money(totals.overheadCost), ""]] : []),
                            ["", "Grand Total", "", "", "", qty(totals.materialQty), "", qty(totals.materialTotalQty), "", money(totals.totalCost), ""],
                          ]
                        : []
                    }
                    empty="Add the raw and packaging materials one lot needs."
                  />
                </>
              )}

              {tab === "wastage" && (
                <>
                  <div className="grid items-start gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                    <ItemPicker lookups={lookups} items={items} value={wastagePicker} onChange={setWastagePicker} itemLabelText="Item" error={entryError.wastageItem} />
                    <SelectField
                      label="Output Type"
                      required
                      value={wastageEntry.outputType}
                      options={WASTAGE_TYPES.map((type) => ({ value: type, label: WASTAGE_TYPE_LABELS[type] }))}
                      onChange={(event) => setWastageEntry({ ...wastageEntry, outputType: event.target.value as WastageType })}
                    />
                    <TextField
                      label="Ratio Qty (%)"
                      required
                      type="number"
                      min={0}
                      max={100}
                      step="any"
                      placeholder="0.00"
                      value={wastageEntry.ratioPercent}
                      error={entryError.wastageRatio}
                      hint={
                        n(wastageEntry.ratioPercent) > 0
                          ? `≈ ${qty(wastageQty(n(wastageEntry.ratioPercent), wastageEntry.calcWithNetWeight, totals))} per lot`
                          : wastageEntry.calcWithNetWeight
                            ? "Of the production items' net weight"
                            : "Of the input material quantity"
                      }
                      onChange={(event) => setWastageEntry({ ...wastageEntry, ratioPercent: event.target.value })}
                    />
                    <fieldset className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1 lg:mt-1">
                      <legend className="sr-only">Wastage options</legend>
                      <CheckboxField label="Is Mandatory" checked={wastageEntry.isMandatory} onChange={(event) => setWastageEntry({ ...wastageEntry, isMandatory: event.target.checked })} />
                      <CheckboxField
                        label="Calculate With Net Weight"
                        checked={wastageEntry.calcWithNetWeight}
                        onChange={(event) => setWastageEntry({ ...wastageEntry, calcWithNetWeight: event.target.checked })}
                      />
                      <CheckboxField
                        label="Calculate With Process Runner"
                        checked={wastageEntry.calcWithProcessRunner}
                        onChange={(event) => setWastageEntry({ ...wastageEntry, calcWithProcessRunner: event.target.checked })}
                      />
                    </fieldset>
                    <div className="lg:mt-5">
                      <Button variant="accent-soft" onClick={addWastage}>
                        <Plus aria-hidden="true" />
                        Add
                      </Button>
                    </div>
                  </div>
                  {errors.wastages && (
                    <p role="alert" className="text-sm text-danger">
                      {errors.wastages}
                    </p>
                  )}
                  <LineTable
                    columns={[
                      { header: "SL", className: "w-12" },
                      { header: "Item" },
                      { header: "Item Type" },
                      { header: "Output Type" },
                      { header: "Ratio Qty (%)", align: "right" },
                      { header: "Expected Qty", align: "right" },
                      { header: "Mandatory", align: "center" },
                      { header: "With Net Weight", align: "center" },
                      { header: "With Process Runner", align: "center" },
                      { header: "Remove", align: "center", className: "w-16" },
                    ]}
                    rows={values.wastages.map((line, index) => {
                      const item = itemById.get(line.itemId);
                      const flag = (key: "isMandatory" | "calcWithNetWeight" | "calcWithProcessRunner", label: string) => (
                        <input
                          key={key}
                          type="checkbox"
                          aria-label={label}
                          checked={line[key]}
                          onChange={(event) => updateLine("wastages", index, { [key]: event.target.checked })}
                          className="size-4 accent-(--accent-strong)"
                        />
                      );
                      return [
                        index + 1,
                        <span key="item" className="text-ink">{item ? itemLabel(item) : (source?.wastages.find((row) => row.itemId === line.itemId)?.name ?? "Unknown item")}</span>,
                        line.itemType || "—",
                        <select
                          key="type"
                          aria-label="Output type"
                          value={line.outputType}
                          onChange={(event) => updateLine("wastages", index, { outputType: event.target.value as WastageType })}
                          className={cn(CONTROL, "h-7 w-32")}
                        >
                          {WASTAGE_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {WASTAGE_TYPE_LABELS[type]}
                            </option>
                          ))}
                        </select>,
                        <CellInput
                          key="r"
                          label="Ratio Qty (%)"
                          className="w-20"
                          value={line.ratioPercent}
                          invalid={!!lineError("wastages", index, "ratioPercent")}
                          onChange={(value) => updateLine("wastages", index, { ratioPercent: value })}
                        />,
                        `${qty(wastageQty(n(line.ratioPercent), line.calcWithNetWeight, totals))} ${item?.uom ?? ""}`,
                        flag("isMandatory", "Is mandatory"),
                        flag("calcWithNetWeight", "Calculate with net weight"),
                        flag("calcWithProcessRunner", "Calculate with process runner"),
                        <RemoveButton key="x" label={`Remove ${item?.name ?? "item"}`} onClick={() => removeLine("wastages", index)} />,
                      ];
                    })}
                    empty="No scrap, by-product, runner, rework or defect output (optional)."
                  />
                  <p className="text-xs text-ink-faint">
                    Expected Qty = Ratio Qty (%) of the input material quantity after wastage ({qty(totals.materialTotalQty)}), or of the production items&apos; net
                    weight ({qty(totals.outputWeight)}) when &quot;Calculate With Net Weight&quot; is ticked.
                  </p>
                </>
              )}

              {tab === "overhead" && (
                <>
                  <div className="grid items-start gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_auto_minmax(0,1fr)_auto]">
                    <SelectField
                      label="Overhead Account"
                      required
                      value={overheadEntry.accountId}
                      error={entryError.overheadAccount}
                      hint={lookups.accounts.length === 0 ? "No active expense account in the Chart of Accounts yet." : undefined}
                      options={[
                        { value: "", label: lookups.accounts.length ? "Choose an expense account" : "No expense account" },
                        ...lookups.accounts.map((account) => ({ value: account.id, label: `${account.code} - ${account.name}` })),
                      ]}
                      onChange={(event) => setOverheadEntry({ ...overheadEntry, accountId: event.target.value })}
                    />
                    <fieldset className="flex flex-col gap-1">
                      <legend className="text-xs text-ink-muted">Based On</legend>
                      <div className="flex h-7 items-center gap-4">
                        {(["percentage", "amount"] as const).map((mode) => (
                          <label key={mode} className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-ink">
                            <input
                              type="radio"
                              name="overheadMode"
                              checked={overheadEntry.mode === mode}
                              onChange={() => setOverheadEntry({ ...overheadEntry, mode, value: "" })}
                              className="size-4 accent-(--accent-strong)"
                            />
                            {mode === "percentage" ? "Percentage" : "Fixed Amount"}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <TextField
                      label={overheadEntry.mode === "percentage" ? "Percentage (%)" : "Amount (per lot)"}
                      required
                      type="number"
                      min={0}
                      step="any"
                      placeholder="0.00"
                      value={overheadEntry.value}
                      error={entryError.overheadValue}
                      hint={
                        overheadEntry.mode === "percentage"
                          ? n(overheadEntry.value) > 0
                            ? `= ${money(overheadAmount(totals.materialCost, n(overheadEntry.value), 0))} of ${money(totals.materialCost)} material`
                            : "Of the material cost"
                          : undefined
                      }
                      onChange={(event) => setOverheadEntry({ ...overheadEntry, value: event.target.value })}
                    />
                    <Button variant="accent-soft" className="sm:mt-5" onClick={addOverhead}>
                      <Plus aria-hidden="true" />
                      Add
                    </Button>
                  </div>
                  {errors.overheads && (
                    <p role="alert" className="text-sm text-danger">
                      {errors.overheads}
                    </p>
                  )}
                  <LineTable
                    columns={[
                      { header: "SL", className: "w-12" },
                      { header: "Account Code" },
                      { header: "Account Name" },
                      { header: "Percentage", align: "right" },
                      { header: "Amount", align: "right" },
                      { header: "Remove", align: "center", className: "w-16" },
                    ]}
                    rows={values.overheads.map((line, index) => {
                      const account = accountById.get(line.accountId) ?? source?.overheads.find((row) => row.accountId === line.accountId);
                      const code = account && "code" in account ? account.code : (account?.accountCode ?? "");
                      const name = account && "name" in account ? account.name : (account?.accountName ?? "Unknown account");
                      const byPercent = line.percentage.trim() !== "";
                      return [
                        index + 1,
                        code,
                        <span key="name" className="text-ink">{name}</span>,
                        byPercent ? (
                          <CellInput
                            key="p"
                            label="Percentage"
                            className="w-20"
                            value={line.percentage}
                            invalid={!!lineError("overheads", index, "percentage")}
                            onChange={(value) => updateLine("overheads", index, { percentage: value })}
                          />
                        ) : (
                          "—"
                        ),
                        byPercent ? (
                          money(overheadAmount(totals.materialCost, n(line.percentage), 0))
                        ) : (
                          <CellInput
                            key="a"
                            label="Amount"
                            value={line.amount}
                            invalid={!!lineError("overheads", index, "amount")}
                            onChange={(value) => updateLine("overheads", index, { amount: value })}
                          />
                        ),
                        <RemoveButton key="x" label={`Remove ${name}`} onClick={() => removeLine("overheads", index)} />,
                      ];
                    })}
                    footer={values.overheads.length ? [["", "", "Total Overhead", "", money(totals.overheadCost), ""]] : []}
                    empty="No overhead (optional). The BOM value is materials plus overheads."
                  />
                </>
              )}
            </div>
          </Tabs>
        </Card>

        <Card className="flex flex-wrap items-center justify-end gap-6 p-4 text-sm">
          <span className="text-ink-muted">
            Material: <strong className="text-ink tabular-nums">{money(totals.materialCost)}</strong>
          </span>
          <span className="text-ink-muted">
            Overhead: <strong className="text-ink tabular-nums">{money(totals.overheadCost)}</strong>
          </span>
          <span className="text-ink-muted">
            BOM Value: <strong className="text-lg text-ink tabular-nums">{money(totals.totalCost)}</strong>
          </span>
        </Card>
      </div>

      <MasterDialog
        kind={adding}
        businessUnitId={unit || undefined}
        departmentId={values.departmentId || undefined}
        departments={departments}
        onClose={() => setAdding(null)}
        onCreated={added}
      />
      <ConfirmDialog
        open={deleting}
        title="Delete Bill Of Material"
        message={`Delete ${record?.name ?? "this BOM"} and all its lines? This cannot be undone.`}
        busy={busy}
        onConfirm={remove}
        onClose={() => setDeleting(false)}
      />
    </PageContainer>
  );
}
