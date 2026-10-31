"use client";

import { ArrowLeft, Save, SaveAll } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
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
  DEFAULT_ITEM_TYPE,
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
  tracking: "NONE" | "BATCH";
  itemDescription: string;
  hsCode: string;
  partNo: string;
  manufacturerName: string;
  countryOfOrigin: string;
  tag: string;
  calculatedBasePrice: string;
  priceIncreasing: string;
  costPrice: string;
  standardSalesPrice: string;
  basePrice: string;
  maxDiscount: string;
  salesTaxSetup: string;
  purchaseTaxSetup: string;
  taxItemType: string;
  supplyType: string;
  selectSupplier: string;
  reorderMinQty: string;
  minSalesQty: string;
  office: string;
  warehouse: string;
  itemLocation: string;
  profitCenter: string;
  dimension: string;
  expireDate: string;
  batchExpiredDays: string;
  tagCustomer: string;
  tagSupplier: string;
};

const EMPTY: FormState = {
  businessUnitId: "",
  autoBarcode: false,
  canBeSold: true,
  canBePurchased: true,
  canBeProduced: true,
  canBeRented: false,
  noDecimal: false,
  allowEbt: false,
  isDefault: false,
  code: "",
  printedCode: "",
  name: "",
  printedName: "",
  itemType: DEFAULT_ITEM_TYPE,
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
  itemDescription: "",
  hsCode: "",
  partNo: "",
  manufacturerName: "",
  countryOfOrigin: "",
  tag: "",
  calculatedBasePrice: "",
  priceIncreasing: "",
  costPrice: "",
  standardSalesPrice: "",
  basePrice: "",
  maxDiscount: "",
  salesTaxSetup: "VAT-[15%] SD-[0%] AIT-[0%]",
  purchaseTaxSetup: "",
  taxItemType: "",
  supplyType: "",
  selectSupplier: "",
  reorderMinQty: "",
  minSalesQty: "",
  office: "",
  warehouse: "",
  itemLocation: "",
  profitCenter: "",
  dimension: "",
  expireDate: "",
  batchExpiredDays: "",
  tagCustomer: "",
  tagSupplier: "",
};

/** Fields on the Additional Information tab (to jump there when one has an error). */
const ADDITIONAL_FIELDS = new Set([
  "barcode",
  "brand",
  "sellingPrice",
  "retailPrice",
  "dealerPrice",
  "tradingPrice",
  "purchasePrice",
  "vatPercent",
  "itemDescription",
  "hsCode",
  "partNo",
  "manufacturerName",
  "countryOfOrigin",
  "tag",
  "calculatedBasePrice",
  "priceIncreasing",
  "costPrice",
  "standardSalesPrice",
  "basePrice",
  "maxDiscount",
  "salesTaxSetup",
  "purchaseTaxSetup",
  "taxItemType",
  "supplyType",
  "selectSupplier",
  "reorderMinQty",
  "minSalesQty",
  "office",
  "warehouse",
  "itemLocation",
  "profitCenter",
  "dimension",
  "expireDate",
  "batchExpiredDays",
  "tagCustomer",
  "tagSupplier",
]);

const TABS = [
  { id: "basic", label: "Basic Information" },
  { id: "additional", label: "Additional Information" },
] as const;

// ─── Loader ───────────────────────────────────────────────────────────────────

/** Embeds the form in another screen (e.g. a dialog): the saved item is handed back instead of navigating. */
export interface EmbeddedItemForm {
  /** Business unit to start with (the calling document's). */
  businessUnitId?: string;
  onSaved: (item: ItemDto) => void;
  onCancel: () => void;
}

export function ItemFormView({ itemId, embedded }: { itemId?: string; embedded?: EmbeddedItemForm }) {
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
    const preset = embedded?.businessUnitId && units.some((unit) => unit.id === embedded.businessUnitId) ? embedded.businessUnitId : undefined;
    return { ...EMPTY, businessUnitId: preset ?? (units.length === 1 ? units[0].id : "") };
  }, [item.data, options.data, embedded?.businessUnitId]);
  const error = options.error ?? item.error;
  const ready = options.data && (!itemId || item.data);
  // New editor (fresh state) after "Save & New".
  const [round, setRound] = useState(0);

  const Shell = embedded ? EmbeddedShell : FullPageShell;
  return (
    <Shell>
      {error || !ready ? (
        <>
          {!embedded && <PageHead title={title} breadcrumbs={breadcrumbs} />}
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
          embedded={embedded}
        />
      )}
    </Shell>
  );
}

const FullPageShell = ({ children }: { children: ReactNode }) => <PageContainer full>{children}</PageContainer>;
const EmbeddedShell = ({ children }: { children: ReactNode }) => <div className="flex flex-col gap-4">{children}</div>;

// ─── Editor ───────────────────────────────────────────────────────────────────

interface EditorProps {
  itemId?: string;
  title: string;
  breadcrumbs: { label: string; href: string }[];
  initial: FormState;
  options: ItemFormOptions;
  onOptionsChange: (update: (current: ItemFormOptions) => ItemFormOptions) => void;
  onSavedNew: () => void;
  embedded?: EmbeddedItemForm;
}

function ItemEditor({ itemId, title, breadcrumbs, initial, options, onOptionsChange, onSavedNew, embedded }: EditorProps) {
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
      if (embedded) {
        embedded.onSaved(saved);
      } else if (mode === "new") {
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
      {!embedded && (
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
      )}

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
                  <Field label="Item Type" required error={err("itemType")}>
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

            <div className={cn("flex flex-col gap-5 px-5 py-4", tab !== "additional" && "hidden")}>
              {/* Row 1: Item Description, H.S Code, Brand, Part No/ Model, Manufacturer Name, Country Of Origin */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                <Field label="Item Description" error={err("itemDescription")}>
                  {(id) => <Input id={id} placeholder="itemDescription" value={form.itemDescription} maxLength={300} onChange={text("itemDescription")} />}
                </Field>
                <Field label="H.S Code" error={err("hsCode")}>
                  {(id) => <Input id={id} placeholder="hscode" value={form.hsCode} maxLength={50} onChange={text("hsCode")} />}
                </Field>
                <Field label="Brand" error={err("brand")}>
                  {(id) => <Input id={id} placeholder="brand" value={form.brand} maxLength={100} onChange={text("brand")} />}
                </Field>
                <Field label="Part No/ Model" error={err("partNo")}>
                  {(id) => <Input id={id} placeholder="partNumber" value={form.partNo} maxLength={100} onChange={text("partNo")} />}
                </Field>
                <Field label="Manufacturer Name" error={err("manufacturerName")}>
                  {(id) => <Input id={id} placeholder="manufacturerName" value={form.manufacturerName} maxLength={150} onChange={text("manufacturerName")} />}
                </Field>
                <Field label="Country Of Origin" error={err("countryOfOrigin")}>
                  {(id) => (
                    <Select
                      id={id}
                      placeholder="Select origin"
                      value={form.countryOfOrigin}
                      options={[
                        { value: "Bangladesh", label: "Bangladesh" },
                        { value: "China", label: "China" },
                        { value: "India", label: "India" },
                        { value: "Japan", label: "Japan" },
                        { value: "Germany", label: "Germany" },
                        { value: "USA", label: "USA" },
                        { value: "Taiwan", label: "Taiwan" },
                        { value: "Other", label: "Other" },
                      ]}
                      onChange={text("countryOfOrigin")}
                    />
                  )}
                </Field>
              </div>

              {/* Row 2: Tag, Calculated Base Price, Price Increasing %, Cost Price, Standard Sales Price, Base Price */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                <Field label="Tag" error={err("tag")}>
                  {(id) => <Input id={id} placeholder="Select item tag" value={form.tag} maxLength={100} onChange={text("tag")} />}
                </Field>
                <Field label="Calculated Base Price" error={err("calculatedBasePrice")}>
                  {(id) => (
                    <Select
                      id={id}
                      placeholder="Select Calculated Base P..."
                      value={form.calculatedBasePrice}
                      options={[
                        { value: "Cost Price", label: "Cost Price" },
                        { value: "Standard Sales Price", label: "Standard Sales Price" },
                        { value: "MRP", label: "MRP" },
                      ]}
                      onChange={text("calculatedBasePrice")}
                    />
                  )}
                </Field>
                <Field label="Price Increasing %" error={err("priceIncreasing")}>
                  {(id) => (
                    <Input
                      id={id}
                      inputMode="decimal"
                      placeholder="%"
                      value={form.priceIncreasing}
                      onChange={decimal("priceIncreasing", /^\d{0,3}(\.\d{0,2})?$/)}
                    />
                  )}
                </Field>
                <Field label="Cost Price" error={err("costPrice")}>
                  {(id) => (
                    <Input
                      id={id}
                      inputMode="decimal"
                      placeholder="stdPurchasePrice"
                      value={form.costPrice}
                      onChange={decimal("costPrice", MONEY)}
                    />
                  )}
                </Field>
                <Field label="Standard Sales Price" error={err("sellingPrice")}>
                  {(id) => (
                    <Input
                      id={id}
                      inputMode="decimal"
                      placeholder="sellingPrice"
                      value={form.sellingPrice}
                      onChange={(e) => {
                        decimal("sellingPrice", MONEY)(e);
                        patch({ standardSalesPrice: e.target.value });
                      }}
                    />
                  )}
                </Field>
                <Field label="Base Price" error={err("basePrice")}>
                  {(id) => (
                    <Input
                      id={id}
                      inputMode="decimal"
                      placeholder="basePrice"
                      value={form.basePrice}
                      onChange={decimal("basePrice", MONEY)}
                    />
                  )}
                </Field>
              </div>

              {/* Row 3: Max Discount(%), Sales Tax Setup, Purchase Tax Setup, Tax Item Type, Supply Type, Select Supplier */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                <Field label="Max Discount(%)" error={err("maxDiscount")}>
                  {(id) => (
                    <Input
                      id={id}
                      inputMode="decimal"
                      placeholder="maxDiscount"
                      value={form.maxDiscount}
                      onChange={decimal("maxDiscount", /^\d{0,3}(\.\d{0,2})?$/)}
                    />
                  )}
                </Field>
                <Field label="Sales Tax Setup" error={err("salesTaxSetup")}>
                  {(id) => (
                    <Select
                      id={id}
                      value={form.salesTaxSetup}
                      options={[
                        { value: "VAT-[15%] SD-[0%] AIT-[0%]", label: "VAT-[15%] SD-[0%] AIT-[0%]" },
                        { value: "VAT-[5%] SD-[0%] AIT-[0%]", label: "VAT-[5%] SD-[0%] AIT-[0%]" },
                        { value: "VAT-[7.5%] SD-[0%] AIT-[0%]", label: "VAT-[7.5%] SD-[0%] AIT-[0%]" },
                        { value: "VAT-[0%] SD-[0%] AIT-[0%]", label: "VAT-[0%] SD-[0%] AIT-[0%]" },
                      ]}
                      onChange={text("salesTaxSetup")}
                    />
                  )}
                </Field>
                <Field label="Purchase Tax Setup" error={err("purchaseTaxSetup")}>
                  {(id) => (
                    <Select
                      id={id}
                      placeholder="purchaseTaxSetup"
                      value={form.purchaseTaxSetup}
                      options={[
                        { value: "VAT-[15%]", label: "VAT-[15%]" },
                        { value: "VAT-[5%]", label: "VAT-[5%]" },
                        { value: "VAT-[0%]", label: "VAT-[0%]" },
                      ]}
                      onChange={text("purchaseTaxSetup")}
                    />
                  )}
                </Field>
                <Field label="Tax Item Type" error={err("taxItemType")}>
                  {(id) => (
                    <Select
                      id={id}
                      placeholder="Select Tax Item Type"
                      value={form.taxItemType}
                      options={[
                        { value: "Standard Rated", label: "Standard Rated" },
                        { value: "Zero Rated", label: "Zero Rated" },
                        { value: "Exempted", label: "Exempted" },
                      ]}
                      onChange={text("taxItemType")}
                    />
                  )}
                </Field>
                <Field label="Supply Type" error={err("supplyType")}>
                  {(id) => (
                    <Select
                      id={id}
                      placeholder="Select Supply Type"
                      value={form.supplyType}
                      options={[
                        { value: "Wholesale", label: "Wholesale" },
                        { value: "Retail", label: "Retail" },
                        { value: "Service", label: "Service" },
                      ]}
                      onChange={text("supplyType")}
                    />
                  )}
                </Field>
                <Field label="Select Supplier" error={err("selectSupplier")}>
                  {(id) => <Input id={id} placeholder="Select/Search Partner (m..." value={form.selectSupplier} maxLength={150} onChange={text("selectSupplier")} />}
                </Field>
              </div>

              {/* Row 4: Re-order/Minimum Qty, Minimum Sales Quantity, Office, Warehouse, Item Location, Profit Center */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                <Field label="Re-order/Minimum Qty" error={err("reorderMinQty")}>
                  {(id) => (
                    <Input
                      id={id}
                      inputMode="decimal"
                      placeholder="stockLimitQuantity"
                      value={form.reorderMinQty}
                      onChange={decimal("reorderMinQty", QTY)}
                    />
                  )}
                </Field>
                <Field label="Minimum Sales Quantity" error={err("minSalesQty")}>
                  {(id) => (
                    <Input
                      id={id}
                      inputMode="decimal"
                      placeholder="minSalesQty"
                      value={form.minSalesQty}
                      onChange={decimal("minSalesQty", QTY)}
                    />
                  )}
                </Field>
                <Field label="Office" error={err("office")}>
                  {(id) => <Input id={id} placeholder="Office" value={form.office || "Head Office"} maxLength={100} onChange={text("office")} />}
                </Field>
                <Field label="Warehouse" error={err("warehouse")}>
                  {(id) => (
                    <Select
                      id={id}
                      placeholder="Select Warehouse"
                      value={form.warehouse}
                      options={[
                        { value: "Main Warehouse", label: "Main Warehouse" },
                        { value: "Finished Goods WH", label: "Finished Goods WH" },
                        { value: "Central WH", label: "Central WH" },
                      ]}
                      onChange={text("warehouse")}
                    />
                  )}
                </Field>
                <Field label="Item Location" error={err("itemLocation")}>
                  {(id) => <Input id={id} placeholder="Select Item Location" value={form.itemLocation} maxLength={100} onChange={text("itemLocation")} />}
                </Field>
                <Field label="Profit Center" error={err("profitCenter")}>
                  {(id) => <Input id={id} placeholder="Select Profit Center" value={form.profitCenter} maxLength={100} onChange={text("profitCenter")} />}
                </Field>
              </div>

              {/* Row 5: Dimension, Expire Date, Batch Expired Days, Barcode, Item Image */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                <Field label="Dimension" error={err("dimension")}>
                  {(id) => <Input id={id} placeholder="Select dimension" value={form.dimension} maxLength={50} onChange={text("dimension")} />}
                </Field>
                <Field label="Expire Date" error={err("expireDate")}>
                  {(id) => <Input id={id} type="date" value={form.expireDate} onChange={text("expireDate")} />}
                </Field>
                <Field label="Batch Expired Days" error={err("batchExpiredDays")}>
                  {(id) => (
                    <Input
                      id={id}
                      inputMode="numeric"
                      placeholder="batchExpiredDays"
                      value={form.batchExpiredDays}
                      onChange={text("batchExpiredDays")}
                    />
                  )}
                </Field>
                <Field label="Barcode" error={err("barcode")}>
                  {(id) => <Input id={id} placeholder="Barcode" value={form.barcode} maxLength={60} onChange={text("barcode")} />}
                </Field>
                <Field label="Item Image">
                  {() => (
                    <div className="flex h-9 items-center gap-2 rounded border border-line bg-canvas px-3 text-xs text-ink-muted">
                      <span>📎 No Attachment</span>
                    </div>
                  )}
                </Field>
              </div>

              {/* Row 6: Tag Customer, Tag Supplier */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Tag Customer" error={err("tagCustomer")}>
                  {(id) => (
                    <Input
                      id={id}
                      placeholder="Select/Search Partner (min 2 letters)"
                      value={form.tagCustomer}
                      maxLength={150}
                      onChange={text("tagCustomer")}
                    />
                  )}
                </Field>
                <Field label="Tag Supplier" error={err("tagSupplier")}>
                  {(id) => (
                    <Input
                      id={id}
                      placeholder="Select/Search Partner (min 2 letters)"
                      value={form.tagSupplier}
                      maxLength={150}
                      onChange={text("tagSupplier")}
                    />
                  )}
                </Field>
              </div>
            </div>
          </Tabs>
        </Panel>

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded border border-line bg-surface/95 px-4 py-2.5 shadow-xs backdrop-blur">
          <SaveState dirty={dirty} />
          {embedded ? (
            <Button variant="ghost" className="text-danger" onClick={embedded.onCancel} disabled={saving !== null}>
              CLOSE
            </Button>
          ) : (
            <>
              <Link href={entityMasterDataPaths.itemProfile} className={buttonClasses("secondary", "md")}>
                Cancel
              </Link>
              <Button variant="accent-soft" loading={saving === "new"} disabled={saving !== null} onClick={() => save("new")}>
                {saving !== "new" && <SaveAll />} Save &amp; New
              </Button>
            </>
          )}
          <Button type="submit" variant="accent" loading={saving === "save"} disabled={saving !== null}>
            {saving !== "save" && <Save />} Save
          </Button>
        </div>
      </form>
    </>
  );
}
