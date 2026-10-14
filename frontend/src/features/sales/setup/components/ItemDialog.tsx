"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { CheckboxField, SelectField, TextField } from "@/components/ui/form-field";
import { FieldGrid } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import { apiFieldErrors, issuesToErrors, numberText, optionalNumber, requiredNumber } from "../../lib/form";
import {
  CATEGORY_LEVEL_LABELS,
  itemInputSchema,
  itemUpdateSchema,
  type ItemOption,
  type SetupLookups,
} from "../../masters/schemas/masters.schema";
import { createItem, updateItem } from "../../masters/services/masters.api";

interface ItemDialogProps {
  open: boolean;
  businessUnitId: string;
  lookups: SetupLookups;
  item: ItemOption | null;
  onClose: () => void;
  onSaved: (item: ItemOption) => void;
}

/** Item form with its price per price type. Mount with a `key` per item. */
export function ItemDialog({ open, businessUnitId, lookups, item, onClose, onSaved }: ItemDialogProps) {
  const toast = useToast();
  const priceLists = lookups.priceLists.filter((list) => list.businessUnitId === businessUnitId);
  const categories = lookups.categories.filter((category) => category.businessUnitId === businessUnitId);
  const [values, setValues] = useState(() => ({
    code: item?.code ?? "",
    name: item?.name ?? "",
    uom: item?.uom ?? "PCS",
    altUom: item?.altUom ?? "",
    altUomFactor: numberText(item?.altUomFactor),
    salesRate: numberText(item?.salesRate ?? 0),
    mrp: numberText(item?.mrp),
    vatPercent: numberText(item?.vatPercent ?? 0),
    deliveryTolerancePercent: numberText(item?.deliveryTolerancePercent ?? 0),
    categoryId: item?.categoryId ?? "",
    isActive: item?.isActive ?? true,
    prices: Object.fromEntries(priceLists.map((list) => [list.id, numberText(item?.prices[list.id])])) as Record<string, string>,
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => setValues((current) => ({ ...current, [key]: value }));

  // Category labels show their path ("Snacks › Chanachur").
  const categoryPath = (id: string): string => {
    const category = categories.find((candidate) => candidate.id === id);
    if (!category) return "";
    return category.parentId ? `${categoryPath(category.parentId)} › ${category.name}` : category.name;
  };

  async function save() {
    const body = {
      code: values.code,
      name: values.name,
      uom: values.uom,
      altUom: values.altUom,
      altUomFactor: optionalNumber(values.altUomFactor),
      salesRate: requiredNumber(values.salesRate),
      mrp: optionalNumber(values.mrp),
      vatPercent: requiredNumber(values.vatPercent || "0"),
      deliveryTolerancePercent: requiredNumber(values.deliveryTolerancePercent || "0"),
      categoryId: values.categoryId || null,
      isActive: values.isActive,
      prices: Object.entries(values.prices)
        .filter(([, rate]) => rate.trim() !== "")
        .map(([priceListId, rate]) => ({ priceListId, rate: Number(rate) })),
    };
    const parsed = item ? itemUpdateSchema.safeParse(body) : itemInputSchema.safeParse({ ...body, businessUnitId });
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const saved = item ? await updateItem(item.id, body) : await createItem({ ...body, businessUnitId });
      toast.success(`${saved.name} saved.`);
      onSaved(saved);
    } catch (error) {
      setErrors(apiFieldErrors(error));
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      size="lg"
      title={item ? `Edit ${item.name}` : "New Item"}
      description={item ? `Code ${item.code}` : "Leave the code blank to generate one."}
      onClose={busy ? () => undefined : onClose}
      onSubmit={save}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={busy}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <FieldGrid>
          <TextField label="Item Name" required value={values.name} error={errors.name} onChange={(event) => set("name", event.target.value)} />
          <TextField label="Item Code" value={values.code} error={errors.code} onChange={(event) => set("code", event.target.value)} />
          <SelectField
            label="Category"
            value={values.categoryId}
            error={errors.categoryId}
            options={[
              { value: "", label: "None" },
              ...categories.map((category) => ({
                value: category.id,
                label: `${categoryPath(category.id)} (${CATEGORY_LEVEL_LABELS[category.level]})`,
              })),
            ]}
            onChange={(event) => set("categoryId", event.target.value)}
          />
          <TextField label="Unit (UOM)" required hint="PCS, KG …" value={values.uom} error={errors.uom} onChange={(event) => set("uom", event.target.value)} />
          <TextField label="Alt. Unit" hint="CTN, Bag … (optional)" value={values.altUom} error={errors.altUom} onChange={(event) => set("altUom", event.target.value)} />
          <TextField
            label="Units per Alt. Unit"
            type="number"
            min={0}
            step="any"
            hint="e.g. 24 PCS in 1 CTN"
            value={values.altUomFactor}
            error={errors.altUomFactor}
            onChange={(event) => set("altUomFactor", event.target.value)}
          />
          <TextField
            label="Default Sales Rate"
            type="number"
            min={0}
            step="any"
            required
            value={values.salesRate}
            error={errors.salesRate}
            onChange={(event) => set("salesRate", event.target.value)}
          />
          <TextField label="MRP" type="number" min={0} step="any" value={values.mrp} error={errors.mrp} onChange={(event) => set("mrp", event.target.value)} />
          <TextField
            label="VAT %"
            type="number"
            min={0}
            max={100}
            step="any"
            value={values.vatPercent}
            error={errors.vatPercent}
            onChange={(event) => set("vatPercent", event.target.value)}
          />
          <TextField
            label="Delivery Tolerance %"
            type="number"
            min={0}
            max={100}
            step="any"
            hint="How much more than ordered may be delivered."
            value={values.deliveryTolerancePercent}
            error={errors.deliveryTolerancePercent}
            onChange={(event) => set("deliveryTolerancePercent", event.target.value)}
          />
        </FieldGrid>

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-ink">Prices by Price Type</h3>
          {priceLists.length === 0 ? (
            <p className="text-xs text-ink-faint">Add price types (Dealer Price, Retail Price …) in the Price Types tab.</p>
          ) : (
            <FieldGrid>
              {priceLists.map((list) => (
                <TextField
                  key={list.id}
                  label={list.name}
                  type="number"
                  min={0}
                  step="any"
                  hint="Blank = default sales rate"
                  value={values.prices[list.id] ?? ""}
                  onChange={(event) => set("prices", { ...values.prices, [list.id]: event.target.value })}
                />
              ))}
            </FieldGrid>
          )}
          {errors.prices && <p className="text-xs text-danger">{errors.prices}</p>}
        </div>

        <CheckboxField label="Active" hint="Inactive items cannot be used on new documents." checked={values.isActive} onChange={(event) => set("isActive", event.target.checked)} />
      </div>
    </Dialog>
  );
}
