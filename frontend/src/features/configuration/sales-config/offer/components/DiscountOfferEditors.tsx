"use client";

import { Download, ListPlus, Trash2, Upload, Wand2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { Checkbox, Field, FormGrid, Notice, Panel, PanelSection, Select, TextArea } from "@/features/configuration/entity-master-data/employee/components/kit";
import {
  AFTER_DISCOUNT_CALC,
  DISCOUNT_TYPES,
  OFFER_BASED_ON,
  SPECIAL_BASED_ON,
  type DiscountOfferInput,
  type SpecialDiscountOfferInput,
} from "../schemas/offer.schema";
import { offerApi } from "../services/offer.api";
import {
  CategoryFields,
  CellError,
  FieldCell,
  HeaderFields,
  insertAfter,
  itemOptions,
  MONEY,
  NumberInput,
  PERCENT,
  QTY,
  removeAt,
  RowButtons,
  rowError,
  toOptions,
  unitOptions,
  type EditorProps,
} from "./offer-form-kit";

// ─── Discount tab ─────────────────────────────────────────────────────────────

type DiscountLine = Required<DiscountOfferInput["lines"][number]>;
export type DiscountForm = Required<Omit<DiscountOfferInput, "lines">> & { lines: DiscountLine[] };
type Defaults = Omit<DiscountLine, "itemId">;

const BLANK_DEFAULTS: Defaults = {
  discountType: "PERCENT",
  amount: "",
  quantity: "",
  minQty: "",
  maxQty: "",
  isRecurrent: false,
  supplierId: "",
  supplierContribution: "",
  internalContribution: "",
};

export function DiscountOfferEditor({ form, patch, errors, options, unit, locked }: EditorProps<DiscountForm> & { locked?: boolean }) {
  const toast = useToast();
  const o = unitOptions(options, unit);
  const [defaults, setDefaults] = useState<Defaults>(BLANK_DEFAULTS);
  const [addItemId, setAddItemId] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const filterCategory = form.minorCategoryId || form.subCategoryId || form.categoryId;
  const inList = new Set(form.lines.map((line) => line.itemId));

  const setLine = (index: number, changes: Partial<DiscountLine>) =>
    patch({ lines: form.lines.map((line, i) => (i === index ? { ...line, ...changes } : line)) });
  const addItems = (itemIds: string[]) => {
    const fresh = itemIds.filter((id) => !inList.has(id));
    if (fresh.length === 0) {
      toast.error("Those items are already in the list.");
      return;
    }
    patch({ lines: [...form.lines, ...fresh.map((itemId) => ({ itemId, ...defaults }))] });
  };
  const applyToAll = () => {
    if (form.lines.length === 0) {
      toast.error("Add items to the list first.");
      return;
    }
    patch({ lines: form.lines.map((line) => ({ ...line, ...defaults })) });
    toast.success(`Applied to all ${form.lines.length} items.`);
  };

  const upload = async (file: File | undefined) => {
    if (!file || !unit) return;
    setUploading(true);
    try {
      const result = await offerApi.parseDiscountLines(unit, file);
      const byItem = new Map(form.lines.map((line) => [line.itemId, line]));
      for (const line of result.lines) byItem.set(line.itemId, line);
      patch({ lines: [...byItem.values()] });
      if (result.errors.length) {
        toast.error(`${result.lines.length} rows loaded; ${result.errors.length} skipped: ${result.errors.map((e) => `row ${e.row}: ${e.message}`).join("; ")}`);
      } else {
        toast.success(`${result.lines.length} rows loaded from the file.`);
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const supplierOptions = o.suppliers.map((supplier) => ({ value: supplier.id, label: `${supplier.code} · ${supplier.name}` }));

  return (
    <>
      <Panel title="Create Offer: Discount" description="Item discounts, optionally shared with a supplier.">
        <HeaderFields options={options} form={form} patch={patch} errors={errors} locked={locked}>
          <Field label="Offer Based On" error={errors.basedOn}>
            {(id) => <Select id={id} value={form.basedOn} options={OFFER_BASED_ON} onChange={(e) => patch({ basedOn: e.target.value as DiscountForm["basedOn"] })} />}
          </Field>
          <Field label="Customer Group" error={errors.customerGroupId}>
            {(id) => <Select id={id} value={form.customerGroupId} disabled={!unit} placeholder="All customer groups" options={toOptions(o.customerGroups)} onChange={(e) => patch({ customerGroupId: e.target.value })} />}
          </Field>
          <Field label="Price Type" error={errors.priceListId}>
            {(id) => <Select id={id} value={form.priceListId} disabled={!unit} placeholder="All price types" options={toOptions(o.priceLists)} onChange={(e) => patch({ priceListId: e.target.value })} />}
          </Field>
        </HeaderFields>

        <PanelSection title="Items" className="mt-4">
          <FormGrid cols={4}>
            <CategoryFields categories={o.categories} disabled={!unit} value={form} onChange={(value) => patch(value)} />
            <div className="flex items-end gap-2">
              <Button variant="accent-soft" disabled={!unit} onClick={() => addItems(o.itemsIn(filterCategory).map((item) => item.id))} title="Add every item of the selected category">
                <ListPlus /> Load Items
              </Button>
            </div>
          </FormGrid>
          <div className="flex flex-wrap items-center gap-2">
            <a href={offerApi.discountTemplateUrl} download className={buttonClasses("secondary", "md")}>
              <Download /> Download Template
            </a>
            <Button loading={uploading} disabled={!unit} onClick={() => fileRef.current?.click()}>
              {!uploading && <Upload />} Upload
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx" className="sr-only" aria-label="Upload discount items" onChange={(e) => upload(e.target.files?.[0])} />
            <div className="ml-auto flex items-center gap-2">
              <Select aria-label="Add one item" className="w-72" value={addItemId} disabled={!unit} placeholder="Add one item…" options={itemOptions(o.items.filter((item) => !inList.has(item.id)))} onChange={(e) => setAddItemId(e.target.value)} />
              <Button
                disabled={!addItemId}
                onClick={() => {
                  addItems([addItemId]);
                  setAddItemId("");
                }}
              >
                <ListPlus /> Add
              </Button>
            </div>
          </div>
        </PanelSection>

        <PanelSection title="Default Values (apply with “All”)">
          <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-10">
            <Field label="Type">
              {(id) => <Select id={id} value={defaults.discountType} placeholder={false} options={DISCOUNT_TYPES} onChange={(e) => setDefaults({ ...defaults, discountType: e.target.value as Defaults["discountType"] })} />}
            </Field>
            <Field label="Amount">
              {() => <NumberInput label="Default amount" value={defaults.amount} pattern={MONEY} onChange={(v) => setDefaults({ ...defaults, amount: v })} />}
            </Field>
            <Field label="Quantity">
              {() => <NumberInput label="Default quantity" value={defaults.quantity} pattern={QTY} onChange={(v) => setDefaults({ ...defaults, quantity: v })} />}
            </Field>
            <Field label="Min. Quantity">
              {() => <NumberInput label="Default minimum quantity" value={defaults.minQty} pattern={QTY} onChange={(v) => setDefaults({ ...defaults, minQty: v })} />}
            </Field>
            <Field label="Max. Quantity">
              {() => <NumberInput label="Default maximum quantity" value={defaults.maxQty} pattern={QTY} onChange={(v) => setDefaults({ ...defaults, maxQty: v })} />}
            </Field>
            <div className="flex h-8 items-center">
              <Checkbox label="Is Recurrent?" checked={defaults.isRecurrent} onChange={(e) => setDefaults({ ...defaults, isRecurrent: e.target.checked })} />
            </div>
            <Field label="Supplier">
              {(id) => <Select id={id} value={defaults.supplierId} disabled={!unit} placeholder="None" options={supplierOptions} onChange={(e) => setDefaults({ ...defaults, supplierId: e.target.value })} />}
            </Field>
            <Field label="Sup. Contrib %">
              {() => <NumberInput label="Default supplier contribution" value={defaults.supplierContribution} pattern={PERCENT} onChange={(v) => setDefaults({ ...defaults, supplierContribution: v })} />}
            </Field>
            <Field label="Internal Contrib %">
              {() => <NumberInput label="Default internal contribution" value={defaults.internalContribution} pattern={PERCENT} onChange={(v) => setDefaults({ ...defaults, internalContribution: v })} />}
            </Field>
            <Button variant="accent" onClick={applyToAll} title="Copy these values to every item in the list">
              <Wand2 /> All
            </Button>
          </div>
        </PanelSection>
      </Panel>

      <Panel title="Item List" actions={<span className="text-xs text-ink-faint">{form.lines.length} item(s)</span>} flush>
        {errors.lines && <div className="px-4 pt-3"><Notice tone="error">{errors.lines}</Notice></div>}
        {form.lines.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-ink-faint">No items yet. Load a category, add an item, or upload the template.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-grid w-full min-w-[1400px]">
              <thead>
                <tr>
                  {["SL", "Item", "Item Code", "UoM", "Type", "Amount/%", "Qty", "Min Qty", "Max Qty", "Recurrent?", "Supplier", "Sup. Contrib %", "Internal Contrib %", "Action"].map((header) => (
                    <th key={header} scope="col" className="px-2.5 py-2 text-left">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {form.lines.map((line, index) => {
                  const item = o.itemById.get(line.itemId);
                  const error = rowError(errors, "lines", index);
                  return (
                    <tr key={line.itemId || index}>
                      <td className="w-12 px-2.5 py-2 text-right align-top text-ink-faint tabular-nums">{index + 1}</td>
                      <td className="px-2.5 py-2 align-top whitespace-nowrap">
                        {item?.name ?? "—"}
                        <CellError message={error} />
                      </td>
                      <td className="px-2.5 py-2 align-top whitespace-nowrap">{item?.code ?? "—"}</td>
                      <td className="px-2.5 py-2 align-top">{item?.uom ?? "—"}</td>
                      <FieldCell>
                        <Select aria-label={`Type, row ${index + 1}`} className="w-32" value={line.discountType} placeholder={false} options={DISCOUNT_TYPES} onChange={(e) => setLine(index, { discountType: e.target.value as DiscountLine["discountType"] })} />
                      </FieldCell>
                      <FieldCell><NumberInput label={`Amount, row ${index + 1}`} value={line.amount} pattern={MONEY} onChange={(v) => setLine(index, { amount: v })} /></FieldCell>
                      <FieldCell><NumberInput label={`Qty, row ${index + 1}`} value={line.quantity} pattern={QTY} onChange={(v) => setLine(index, { quantity: v })} /></FieldCell>
                      <FieldCell><NumberInput label={`Min qty, row ${index + 1}`} value={line.minQty} pattern={QTY} onChange={(v) => setLine(index, { minQty: v })} /></FieldCell>
                      <FieldCell><NumberInput label={`Max qty, row ${index + 1}`} value={line.maxQty} pattern={QTY} onChange={(v) => setLine(index, { maxQty: v })} /></FieldCell>
                      <td className="px-2.5 py-2 text-center align-top">
                        <input type="checkbox" aria-label={`Recurrent, row ${index + 1}`} className="size-4 accent-(--accent-strong)" checked={line.isRecurrent} onChange={(e) => setLine(index, { isRecurrent: e.target.checked })} />
                      </td>
                      <FieldCell>
                        <Select aria-label={`Supplier, row ${index + 1}`} className="w-48" value={line.supplierId} placeholder="None" options={supplierOptions} onChange={(e) => setLine(index, { supplierId: e.target.value })} />
                      </FieldCell>
                      <FieldCell><NumberInput label={`Supplier contribution, row ${index + 1}`} value={line.supplierContribution} pattern={PERCENT} onChange={(v) => setLine(index, { supplierContribution: v })} /></FieldCell>
                      <FieldCell><NumberInput label={`Internal contribution, row ${index + 1}`} value={line.internalContribution} pattern={PERCENT} onChange={(v) => setLine(index, { internalContribution: v })} /></FieldCell>
                      <td className="px-1.5 py-1 text-center align-top">
                        <Button variant="ghost" size="icon" className="hover:text-danger" aria-label={`Remove row ${index + 1}`} title="Remove" onClick={() => patch({ lines: form.lines.filter((_, i) => i !== index) })}>
                          <Trash2 />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

// ─── Special Discount tab ─────────────────────────────────────────────────────

type SpecialLine = Required<SpecialDiscountOfferInput["lines"][number]>;
export type SpecialDiscountForm = Required<Omit<SpecialDiscountOfferInput, "lines">> & { lines: SpecialLine[] };
export const blankSpecialLine = (): SpecialLine => ({
  customerGroupId: "",
  discountType: "PERCENT",
  amount: "",
  fromAmount: "",
  toAmount: "",
  supplierId: "",
  supplierContribution: "",
  internalContribution: "",
  vatOnDiscounted: true,
});

export function SpecialDiscountOfferEditor({ form, patch, errors, options, unit, locked }: EditorProps<SpecialDiscountForm> & { locked?: boolean }) {
  const o = unitOptions(options, unit);
  const setLine = (index: number, changes: Partial<SpecialLine>) =>
    patch({ lines: form.lines.map((line, i) => (i === index ? { ...line, ...changes } : line)) });
  const supplierOptions = o.suppliers.map((supplier) => ({ value: supplier.id, label: `${supplier.code} · ${supplier.name}` }));

  return (
    <>
      <Panel title="Create Offer: Special Discount" description="Discount slabs by invoice amount, per customer group.">
        <HeaderFields options={options} form={form} patch={patch} errors={errors} locked={locked}>
          <Field label="Offer Based On" error={errors.basedOn}>
            {(id) => <Select id={id} value={form.basedOn} options={SPECIAL_BASED_ON} onChange={(e) => patch({ basedOn: e.target.value as SpecialDiscountForm["basedOn"] })} />}
          </Field>
          <Field label="Remarks" span={3} error={errors.remarks}>
            {(id) => <TextArea id={id} rows={1} value={form.remarks} maxLength={500} onChange={(e) => patch({ remarks: e.target.value })} />}
          </Field>
        </HeaderFields>
      </Panel>

      <Panel title="Discount Rows" flush>
        {errors.lines && <div className="px-4 pt-3"><Notice tone="error">{errors.lines}</Notice></div>}
        <div className="overflow-x-auto">
          <table className="data-grid w-full min-w-[1400px]">
            <thead>
              <tr>
                {["SL", "Customer Group", "Discount Type", "Amount/%", "From Amount", "To Amount", "Supplier", "Supplier Contribution %", "Internal Contribution %", "After Discount Calc.", "Action"].map((header) => (
                  <th key={header} scope="col" className="px-2.5 py-2 text-left">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {form.lines.map((line, index) => (
                <tr key={index}>
                  <td className="w-12 px-2.5 py-2 text-right align-top text-ink-faint tabular-nums">{index + 1}</td>
                  <FieldCell>
                    <Select aria-label={`Customer group, row ${index + 1}`} className="w-44" value={line.customerGroupId} disabled={!unit} placeholder="All groups" options={toOptions(o.customerGroups)} onChange={(e) => setLine(index, { customerGroupId: e.target.value })} />
                    <CellError message={rowError(errors, "lines", index)} />
                  </FieldCell>
                  <FieldCell>
                    <Select aria-label={`Discount type, row ${index + 1}`} className="w-32" value={line.discountType} placeholder={false} options={DISCOUNT_TYPES} onChange={(e) => setLine(index, { discountType: e.target.value as SpecialLine["discountType"] })} />
                  </FieldCell>
                  <FieldCell><NumberInput label={`Amount, row ${index + 1}`} value={line.amount} pattern={MONEY} onChange={(v) => setLine(index, { amount: v })} /></FieldCell>
                  <FieldCell><NumberInput label={`From amount, row ${index + 1}`} value={line.fromAmount} pattern={MONEY} onChange={(v) => setLine(index, { fromAmount: v })} /></FieldCell>
                  <FieldCell><NumberInput label={`To amount, row ${index + 1}`} value={line.toAmount} pattern={MONEY} onChange={(v) => setLine(index, { toAmount: v })} /></FieldCell>
                  <FieldCell>
                    <Select aria-label={`Supplier, row ${index + 1}`} className="w-48" value={line.supplierId} disabled={!unit} placeholder="None" options={supplierOptions} onChange={(e) => setLine(index, { supplierId: e.target.value })} />
                  </FieldCell>
                  <FieldCell><NumberInput label={`Supplier contribution, row ${index + 1}`} value={line.supplierContribution} pattern={PERCENT} onChange={(v) => setLine(index, { supplierContribution: v })} /></FieldCell>
                  <FieldCell><NumberInput label={`Internal contribution, row ${index + 1}`} value={line.internalContribution} pattern={PERCENT} onChange={(v) => setLine(index, { internalContribution: v })} /></FieldCell>
                  <FieldCell>
                    <Select
                      aria-label={`After discount calculation, row ${index + 1}`}
                      className={cn("w-52")}
                      value={String(line.vatOnDiscounted)}
                      placeholder={false}
                      options={AFTER_DISCOUNT_CALC}
                      onChange={(e) => setLine(index, { vatOnDiscounted: e.target.value === "true" })}
                    />
                  </FieldCell>
                  <td className="px-1.5 py-1 align-top">
                    <RowButtons
                      index={index}
                      onAdd={() => patch({ lines: insertAfter(form.lines, index, blankSpecialLine()) })}
                      onRemove={() => patch({ lines: removeAt(form.lines, index, blankSpecialLine()) })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
