"use client";

import { ArrowLeft, Save, SaveAll } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { ApiClientError, errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { entityMasterDataBreadcrumbs } from "../../breadcrumbs";
import { AddableSelect } from "../../components/AddableSelect";
import { Checkbox, Field, FormGrid, Input, Notice, Panel, PanelSection, SaveState, Select } from "../../employee/components/kit";
import { entityMasterDataPaths } from "../../paths";
import {
  ITEM_FLAGS,
  ITEM_TYPES,
  itemInputSchema,
  RESTRICTED_AGES,
  TRACKING_OPTIONS,
  type ItemDto,
  type ItemFlag,
  type ItemFormOptions,
  type ItemInput,
} from "../schemas/item.schema";
import { itemApi } from "../services/item.api";

type FormState = Omit<Required<ItemInput>, "itemType" | "restrictedAge" | "tracking"> & {
  itemType: string;
  restrictedAge: string;
  tracking: "NONE" | "BOTH";
};

const EMPTY: FormState = {
  businessUnitId: "",
  autoBarcode: false,
  canBeSold: true,
  canBePurchased: true,
  canBeRented: false,
  noDecimal: false,
  allowEbt: false,
  isDefault: false,
  code: "",
  printedCode: "",
  name: "",
  printedName: "",
  itemType: "",
  uom: "",
  divisionId: "",
  categoryId: "",
  subCategoryId: "",
  minorCategoryId: "",
  altUom: "",
  altUnit: "",
  netWeight: "",
  netWeightUnit: "",
  restrictedAge: "",
  tracking: "NONE",
  barcode: "",
  brand: "",
  sellingPrice: "",
  retailPrice: "",
  dealerPrice: "",
  tradingPrice: "",
  purchasePrice: "",
  vatPercent: "",
};

/** Fields on the Additional Information tab (to jump there when one has an error). */
const ADDITIONAL_FIELDS = new Set(["barcode", "brand", "sellingPrice", "retailPrice", "dealerPrice", "tradingPrice", "purchasePrice", "vatPercent"]);

const TABS = [
  { id: "basic", label: "Basic Information" },
  { id: "additional", label: "Additional Information" },
] as const;

// ─── Loader ───────────────────────────────────────────────────────────────────

export function ItemFormView({ itemId }: { itemId?: string }) {
  const options = useResource("item-form-options", itemApi.formOptions);
  const item = useResource(itemId ? `item:${itemId}` : null, () => itemApi.get(itemId!));
  const title = itemId ? "Edit Item" : "Add Item";
  const breadcrumbs = [
    ...entityMasterDataBreadcrumbs(entityMasterDataPaths.itemProfile),
    { label: itemId ? (item.data?.name ?? "Item") : "Add Item", href: itemId ? entityMasterDataPaths.itemEdit(itemId) : entityMasterDataPaths.itemCreate },
  ];
  const initial = useMemo(() => {
    if (item.data) {
      const { id: _id, isActive: _active, ...rest } = item.data as ItemDto;
      return { ...EMPTY, ...rest } as FormState;
    }
    // A single business unit is chosen automatically.
    const units = options.data?.businessUnits ?? [];
    return { ...EMPTY, businessUnitId: units.length === 1 ? units[0].id : "" };
  }, [item.data, options.data]);
  const error = options.error ?? item.error;
  const ready = options.data && (!itemId || item.data);
  // New editor (fresh state) after "Save & New".
  const [round, setRound] = useState(0);

  return (
    <PageContainer full>
      {error || !ready ? (
        <>
          <PageHead title={title} breadcrumbs={breadcrumbs} />
          <section className="rounded border border-line bg-surface">
            {error ? (
              <ErrorState
                message={error.message}
                onRetry={() => {
                  options.reload();
                  item.reload();
                }}
              />
            ) : (
              <LoadingState label="Loading item form…" />
            )}
          </section>
        </>
      ) : (
        <ItemEditor
          key={`${item.data?.id ?? "new"}-${round}`}
          itemId={itemId}
          title={title}
          breadcrumbs={breadcrumbs}
          initial={initial}
          options={options.data!}
          onOptionsChange={(update) => options.mutate((current) => update(current!))}
          onSavedNew={() => setRound((value) => value + 1)}
        />
      )}
    </PageContainer>
  );
}

// ─── Editor ───────────────────────────────────────────────────────────────────

interface EditorProps {
  itemId?: string;
  title: string;
  breadcrumbs: { label: string; href: string }[];
  initial: FormState;
  options: ItemFormOptions;
  onOptionsChange: (update: (current: ItemFormOptions) => ItemFormOptions) => void;
  onSavedNew: () => void;
}

function ItemEditor({ itemId, title, breadcrumbs, initial, options, onOptionsChange, onSavedNew }: EditorProps) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("basic");
  const [form, setForm] = useState<FormState>(initial);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState<"save" | "new" | null>(null);

  const patch = (changes: Partial<FormState>) => {
    setForm((current) => ({ ...current, ...changes }));
    setDirty(true);
    setErrors((current) => {
      const keys = Object.keys(changes).filter((key) => current[key]);
      if (keys.length === 0) return current;
      const next = { ...current };
      for (const key of keys) delete next[key];
      return next;
    });
  };
  const text = (key: keyof FormState) => (event: { target: { value: string } }) => patch({ [key]: event.target.value } as Partial<FormState>);
  const decimal = (key: keyof FormState, pattern: RegExp) => (event: { target: { value: string } }) =>
    pattern.test(event.target.value) && patch({ [key]: event.target.value } as Partial<FormState>);
  const MONEY = /^\d{0,12}(\.\d{0,2})?$/;
  const QTY = /^\d{0,11}(\.\d{0,3})?$/;

  const unit = form.businessUnitId;
  const unitMissing = unit ? undefined : "Select a business unit first.";
  const ofUnit = <T extends { businessUnitId: string }>(list: T[]) => list.filter((row) => row.businessUnitId === unit);
  const categories = ofUnit(options.categories);
  const level1 = categories.filter((c) => c.level === 1);
  const level2 = categories.filter((c) => form.categoryId && c.parentId === form.categoryId);
  const level3 = categories.filter((c) => form.subCategoryId && c.parentId === form.subCategoryId);
  const uomOptions = ofUnit(options.uoms).map((u) => ({ value: u.name, label: u.name }));
  // Keep an existing item's unit selectable even if it isn't in the list.
  const withCurrent = (list: { value: string; label: string }[], value: string) =>
    value && !list.some((o) => o.value === value) ? [{ value, label: value }, ...list] : list;
  const toOptions = (list: { id: string; name: string }[]) => list.map((row) => ({ value: row.id, label: row.name }));

  const addCategory = async (name: string, parentId = "") => {
    const created = await itemApi.addCategory({ businessUnitId: unit, parentId, name, description: "" });
    onOptionsChange((current) => ({ ...current, categories: [...current.categories, created] }));
    return created.id;
  };
  const addDivision = async (name: string) => {
    const created = await itemApi.addDivision({ businessUnitId: unit, name });
    onOptionsChange((current) => ({ ...current, divisions: [...current.divisions, created] }));
    return created.id;
  };
  const addUom = async (name: string) => {
    const created = await itemApi.addUom({ businessUnitId: unit, name });
    onOptionsChange((current) =>
      current.uoms.some((u) => u.businessUnitId === created.businessUnitId && u.name === created.name)
        ? current
        : { ...current, uoms: [...current.uoms, created] },
    );
    return created.name;
  };

  const save = async (mode: "save" | "new") => {
    setFormError(null);
    const parsed = itemInputSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[issue.path.join(".")] ??= issue.message;
      setErrors(next);
      setFormError("Please correct the highlighted fields.");
      const keys = Object.keys(next);
      if (keys.length && keys.every((key) => ADDITIONAL_FIELDS.has(key))) setTab("additional");
      else if (keys.some((key) => !ADDITIONAL_FIELDS.has(key))) setTab("basic");
      return;
    }
    setSaving(mode);
    try {
      const payload = form as ItemInput;
      const saved = itemId ? await itemApi.update(itemId, payload) : await itemApi.create(payload);
      toast.success(`Item ${saved.code} saved.`);
      if (mode === "new") {
        if (itemId) router.push(entityMasterDataPaths.itemCreate);
        else onSavedNew();
      } else {
        router.push(entityMasterDataPaths.itemProfile);
      }
    } catch (err) {
      if (err instanceof ApiClientError && err.fieldErrors) {
        setErrors(Object.fromEntries(Object.entries(err.fieldErrors).map(([key, list]) => [key, list[0] ?? ""])));
      }
      setFormError(errorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  const err = (key: string) => errors[key];
  const invalid = (key: string) => !!errors[key] || undefined;
  const tabErrors = (ids: string[]) => ids.some((id) => errors[id]);
  const tabsWithBadges = TABS.map((t) => ({
    ...t,
    badge:
      t.id === "additional" && tabErrors([...ADDITIONAL_FIELDS])
        ? "!"
        : t.id === "basic" && Object.keys(errors).some((key) => !ADDITIONAL_FIELDS.has(key))
          ? "!"
          : undefined,
  }));

  return (
    <>
      <PageHead
        title={title}
        subtitle={itemId ? `Item code ${initial.code}` : "Basic and additional information. Items are shared with Sales and Purchase."}
        breadcrumbs={breadcrumbs}
        actions={
          <Link href={entityMasterDataPaths.itemProfile} className={buttonClasses("secondary", "md")}>
            <ArrowLeft /> All Items
          </Link>
        }
      />

      <form
        noValidate
        className="flex flex-col gap-4 pb-6"
        onSubmit={(event) => {
          event.preventDefault();
          void save("save");
        }}
      >
        {formError && <Notice tone="error">{formError}</Notice>}

        <Panel flush>
          <Tabs tabs={tabsWithBadges} value={tab} onChange={setTab} label="Item sections">
            <div className={cn("px-5 py-4", tab !== "basic" && "hidden")}>
              <PanelSection title="Checklist">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                  {ITEM_FLAGS.map((flag) => (
                    <Checkbox
                      key={flag.key}
                      label={flag.label}
                      checked={form[flag.key as ItemFlag]}
                      onChange={(e) => patch({ [flag.key]: e.target.checked } as Partial<FormState>)}
                    />
                  ))}
                </div>
              </PanelSection>

              <PanelSection title="Item">
                <FormGrid cols={4}>
                  {options.businessUnits.length > 1 && (
                    <Field label="Business Unit" required error={err("businessUnitId")}>
                      {(id) => (
                        <Select
                          id={id}
                          value={form.businessUnitId}
                          disabled={!!itemId}
                          options={toOptions(options.businessUnits)}
                          aria-invalid={invalid("businessUnitId")}
                          onChange={(e) =>
                            patch({ businessUnitId: e.target.value, divisionId: "", categoryId: "", subCategoryId: "", minorCategoryId: "" })
                          }
                        />
                      )}
                    </Field>
                  )}
                  <Field label="Master Item Code" required error={err("code")}>
                    {(id) => <Input id={id} value={form.code} maxLength={30} aria-invalid={invalid("code")} onChange={text("code")} />}
                  </Field>
                  <Field label="Printed Item Code" required error={err("printedCode")}>
                    {(id) => <Input id={id} value={form.printedCode} maxLength={30} aria-invalid={invalid("printedCode")} onChange={text("printedCode")} />}
                  </Field>
                  <Field label="Master Item Name" required error={err("name")}>
                    {(id) => <Input id={id} value={form.name} maxLength={200} aria-invalid={invalid("name")} onChange={text("name")} />}
                  </Field>
                  <Field label="Printed / Customer Name" required error={err("printedName")}>
                    {(id) => <Input id={id} value={form.printedName} maxLength={200} aria-invalid={invalid("printedName")} onChange={text("printedName")} />}
                  </Field>
                  <Field label="Item Type" error={err("itemType")}>
                    {(id) => <Select id={id} value={form.itemType} options={ITEM_TYPES} onChange={text("itemType")} />}
                  </Field>
                  <AddableSelect
                    label="UOM"
                    required
                    value={form.uom}
                    options={withCurrent(uomOptions, form.uom)}
                    onChange={(value) => patch({ uom: value })}
                    onAdd={addUom}
                    disabledReason={unitMissing}
                    error={err("uom")}
                  />
                  <AddableSelect
                    label="Division"
                    value={form.divisionId}
                    options={toOptions(ofUnit(options.divisions))}
                    onChange={(value) => patch({ divisionId: value })}
                    onAdd={addDivision}
                    disabledReason={unitMissing}
                    error={err("divisionId")}
                  />
                </FormGrid>
              </PanelSection>

              <PanelSection title="Category">
                <FormGrid cols={3}>
                  <AddableSelect
                    label="Category"
                    value={form.categoryId}
                    options={toOptions(level1)}
                    onChange={(value) => patch({ categoryId: value, subCategoryId: "", minorCategoryId: "" })}
                    onAdd={(name) => addCategory(name)}
                    disabledReason={unitMissing}
                    error={err("categoryId")}
                  />
                  <AddableSelect
                    label="Sub Category"
                    value={form.subCategoryId}
                    options={toOptions(level2)}
                    onChange={(value) => patch({ subCategoryId: value, minorCategoryId: "" })}
                    onAdd={(name) => addCategory(name, form.categoryId)}
                    disabledReason={unitMissing ?? (form.categoryId ? undefined : "Select a category first.")}
                    error={err("subCategoryId")}
                  />
                  <AddableSelect
                    label="Minor Category"
                    value={form.minorCategoryId}
                    options={toOptions(level3)}
                    onChange={(value) => patch({ minorCategoryId: value })}
                    onAdd={(name) => addCategory(name, form.subCategoryId)}
                    disabledReason={unitMissing ?? (form.subCategoryId ? undefined : "Select a sub category first.")}
                    error={err("minorCategoryId")}
                  />
                </FormGrid>
              </PanelSection>

              <PanelSection title="Units & Weight">
                <FormGrid cols={4}>
                  <Field label="Alt. UOM" error={err("altUom")}>
                    {(id) => <Select id={id} value={form.altUom} disabled={!unit} options={withCurrent(uomOptions, form.altUom)} onChange={text("altUom")} />}
                  </Field>
                  <Field label="Alt. Unit" error={err("altUnit")} hint="Base units in one alt. UOM (e.g. 12 Pcs per Box).">
                    {(id) => <Input id={id} inputMode="decimal" value={form.altUnit} aria-invalid={invalid("altUnit")} onChange={decimal("altUnit", QTY)} />}
                  </Field>
                  <Field label="Net Weight" error={err("netWeight")}>
                    {(id) => <Input id={id} inputMode="decimal" value={form.netWeight} aria-invalid={invalid("netWeight")} onChange={decimal("netWeight", QTY)} />}
                  </Field>
                  <Field label="Net Weight Unit" error={err("netWeightUnit")}>
                    {(id) => (
                      <Select id={id} value={form.netWeightUnit} disabled={!unit} options={withCurrent(uomOptions, form.netWeightUnit)} onChange={text("netWeightUnit")} />
                    )}
                  </Field>
                  <Field label="Restricted Ages" error={err("restrictedAge")}>
                    {(id) => <Select id={id} value={form.restrictedAge} options={RESTRICTED_AGES} onChange={text("restrictedAge")} />}
                  </Field>
                  <fieldset className="flex flex-col gap-1">
                    <legend className="mb-1 text-xs font-semibold text-ink-muted">Tracking</legend>
                    <div className="flex h-8 items-center gap-4">
                      {TRACKING_OPTIONS.map((option) => (
                        <label key={option.value} className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-ink">
                          <input
                            type="radio"
                            name="tracking"
                            value={option.value}
                            checked={form.tracking === option.value}
                            onChange={() => patch({ tracking: option.value })}
                            className="size-4 accent-(--accent-strong)"
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </FormGrid>
              </PanelSection>
            </div>

            <div className={cn("px-5 py-4", tab !== "additional" && "hidden")}>
              <PanelSection title="Identification">
                <FormGrid cols={4}>
                  <Field label="Barcode" error={err("barcode")} hint={form.autoBarcode ? "Leave empty to generate one on save." : undefined}>
                    {(id) => <Input id={id} value={form.barcode} maxLength={60} onChange={text("barcode")} />}
                  </Field>
                  <Field label="Brand" error={err("brand")}>
                    {(id) => <Input id={id} value={form.brand} maxLength={100} onChange={text("brand")} />}
                  </Field>
                </FormGrid>
              </PanelSection>
              <PanelSection title="Prices & VAT">
                <FormGrid cols={4}>
                  {(
                    [
                      ["sellingPrice", "Selling Price"],
                      ["retailPrice", "Retail Price (MRP)"],
                      ["dealerPrice", "Dealer Price"],
                      ["tradingPrice", "Trading Price"],
                      ["purchasePrice", "Purchase Price"],
                    ] as const
                  ).map(([key, label]) => (
                    <Field key={key} label={label} error={err(key)}>
                      {(id) => (
                        <Input
                          id={id}
                          inputMode="decimal"
                          placeholder="0.00"
                          className="text-right tabular-nums"
                          value={form[key]}
                          aria-invalid={invalid(key)}
                          onChange={decimal(key, MONEY)}
                        />
                      )}
                    </Field>
                  ))}
                  <Field label="VAT %" error={err("vatPercent")}>
                    {(id) => (
                      <Input
                        id={id}
                        inputMode="decimal"
                        placeholder="0"
                        className="text-right tabular-nums"
                        value={form.vatPercent}
                        aria-invalid={invalid("vatPercent")}
                        onChange={decimal("vatPercent", /^\d{0,3}(\.\d{0,2})?$/)}
                      />
                    )}
                  </Field>
                </FormGrid>
              </PanelSection>
            </div>
          </Tabs>
        </Panel>

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded border border-line bg-surface/95 px-4 py-2.5 shadow-xs backdrop-blur">
          <SaveState dirty={dirty} />
          <Link href={entityMasterDataPaths.itemProfile} className={buttonClasses("secondary", "md")}>
            Cancel
          </Link>
          <Button variant="accent-soft" loading={saving === "new"} disabled={saving !== null} onClick={() => save("new")}>
            {saving !== "new" && <SaveAll />} Save &amp; New
          </Button>
          <Button type="submit" variant="accent" loading={saving === "save"} disabled={saving !== null}>
            {saving !== "save" && <Save />} Save
          </Button>
        </div>
      </form>
    </>
  );
}
