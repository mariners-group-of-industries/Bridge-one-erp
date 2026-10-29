"use client";

import { ArrowLeft, CopyPlus, ListPlus, ListX, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { entityMasterDataBreadcrumbs } from "@/features/configuration/entity-master-data/breadcrumbs";
import { Checkbox, Field, FormGrid, Input, Notice, Panel, PanelSection, SaveState, Select, TextArea } from "@/features/configuration/entity-master-data/employee/components/kit";
import { CategoryFields, itemOptions, MONEY, NumberInput, QTY, toOptions } from "../../offer/components/offer-form-kit";
import { salesConfigPaths } from "../../paths";
import {
  customerPriceSchema,
  groupPriceSchema,
  ITEM_TYPES,
  slugFromTab,
  type CustomerPriceDto,
  type CustomerPriceInput,
  type GroupPriceDto,
  type GroupPriceInput,
  type PriceSetupOptions,
  type PriceTab,
} from "../schemas/customer-price.schema";
import { customerPriceApi } from "../services/customer-price.api";

type CustomerForm = Required<Omit<CustomerPriceInput, "lines">> & { lines: Required<CustomerPriceInput["lines"][number]>[] };
type GroupForm = Required<Omit<GroupPriceInput, "lines">> & { lines: Required<GroupPriceInput["lines"][number]>[] };
type Errors = Record<string, string>;

const today = () => new Date().toISOString().slice(0, 10);
/** New setups start on sellable items; choose "All item types" to see the rest. */
const FILTER = { itemType: "Finished Goods", categoryId: "", subCategoryId: "", minorCategoryId: "" } as const;
const blankGroupLine = (itemId = ""): GroupForm["lines"][number] => ({ itemId, fromDate: "", toDate: "", fromQty: "", toQty: "", dpPrice: "", tpPrice: "" });

/** Items of a business unit matching the item type and the deepest selected category (incl. children). */
function filteredItems(options: PriceSetupOptions, unit: string, filter: { itemType: string; categoryId: string; subCategoryId: string; minorCategoryId: string }) {
  const categories = options.categories.filter((c) => c.businessUnitId === unit);
  const root = filter.minorCategoryId || filter.subCategoryId || filter.categoryId;
  const ids = new Set(root ? [root] : []);
  if (root) {
    for (let grew = true; grew; ) {
      grew = false;
      for (const c of categories) {
        if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
          ids.add(c.id);
          grew = true;
        }
      }
    }
  }
  return options.items.filter(
    (item) => item.businessUnitId === unit && (!filter.itemType || item.itemType === filter.itemType) && (!root || (item.categoryId && ids.has(item.categoryId))),
  );
}

// ─── Loader ───────────────────────────────────────────────────────────────────

export function PriceSetupFormView({ tab, setupId }: { tab: PriceTab; setupId?: string }) {
  const options = useResource("price-setup-options", customerPriceApi.options);
  const setup = useResource<CustomerPriceDto | GroupPriceDto>(setupId ? `price-setup:${tab}:${setupId}` : null, () =>
    tab === "customer" ? customerPriceApi.getCustomer(setupId!) : customerPriceApi.getGroup(setupId!),
  );
  const title = tab === "customer" ? (setupId ? "Edit Customer Price" : "Customer Price Setup") : setupId ? "Edit Customer Group Price" : "Customer Group Price Setup";
  const backHref = `${salesConfigPaths.customerPriceSetup}?tab=${slugFromTab(tab)}`;
  const breadcrumbs = [...entityMasterDataBreadcrumbs(salesConfigPaths.customerPriceSetup), { label: title, href: backHref }];

  const initial = useMemo(() => {
    if (!options.data) return null;
    if (setup.data) {
      const { id: _id, ...rest } = setup.data as (CustomerPriceDto | GroupPriceDto) & { isActive?: boolean };
      delete rest.isActive;
      return rest as CustomerForm | GroupForm;
    }
    const units = options.data.businessUnits;
    const unit = units.length === 1 ? units[0].id : "";
    return tab === "customer"
      ? ({ businessUnitId: unit, priceListId: "", customerId: "", ...FILTER, lines: [] } as CustomerForm)
      : ({ businessUnitId: unit, priceListId: "", officeId: "", customerGroupId: "", createDate: today(), circularNo: "", remarks: "", isRunning: true, ...FILTER, lines: [] } as GroupForm);
  }, [options.data, setup.data, tab]);

  return (
    <PageContainer full>
      {options.error || setup.error || !initial || (setupId && !setup.data) ? (
        <>
          <PageHead title={title} breadcrumbs={breadcrumbs} />
          <section className="rounded border border-line bg-surface">
            {options.error || setup.error ? (
              <ErrorState
                message={(options.error ?? setup.error)!.message}
                onRetry={() => {
                  options.reload();
                  setup.reload();
                }}
              />
            ) : (
              <LoadingState label="Loading…" />
            )}
          </section>
        </>
      ) : (
        <Editor key={setupId ?? tab} tab={tab} setupId={setupId} title={title} breadcrumbs={breadcrumbs} backHref={backHref} initial={initial} options={options.data!} />
      )}
    </PageContainer>
  );
}

// ─── Editor ───────────────────────────────────────────────────────────────────

function Editor({
  tab,
  setupId,
  title,
  breadcrumbs,
  backHref,
  initial,
  options,
}: {
  tab: PriceTab;
  setupId?: string;
  title: string;
  breadcrumbs: { label: string; href: string }[];
  backHref: string;
  initial: CustomerForm | GroupForm;
  options: PriceSetupOptions;
}) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [addItemId, setAddItemId] = useState("");

  const patch = (changes: Partial<CustomerForm & GroupForm>) => {
    setForm((current) => ({ ...current, ...changes }) as CustomerForm | GroupForm);
    setDirty(true);
    setErrors({});
  };
  const unit = form.businessUnitId;
  const of = <T extends { businessUnitId: string }>(list: T[]) => list.filter((row) => row.businessUnitId === unit);
  const itemById = new Map(options.items.map((item) => [item.id, item]));
  const matching = filteredItems(options, unit, form);
  const inList = new Set(form.lines.map((line) => line.itemId));
  const isCustomer = tab === "customer";

  const addItems = (ids: string[]) => {
    // Customer prices hold each item once; group prices may repeat an item for slabs.
    const fresh = isCustomer ? ids.filter((id) => !inList.has(id)) : ids;
    if (fresh.length === 0) {
      toast.error(ids.length ? "Those items are already in the list." : "No items match the filter.");
      return;
    }
    const lines = isCustomer
      ? [...(form.lines as CustomerForm["lines"]), ...fresh.map((itemId) => ({ itemId, dpPrice: "", tpPrice: "" }))]
      : [...(form.lines as GroupForm["lines"]), ...fresh.map((itemId) => blankGroupLine(itemId))];
    patch({ lines } as Partial<CustomerForm & GroupForm>);
  };
  const setLine = (index: number, changes: Record<string, string>) =>
    patch({ lines: (form.lines as Record<string, string>[]).map((line, i) => (i === index ? { ...line, ...changes } : line)) } as never);
  const removeLine = (index: number) => patch({ lines: (form.lines as unknown[]).filter((_, i) => i !== index) } as never);
  const copyLine = (index: number) => {
    const lines = [...(form.lines as GroupForm["lines"])];
    lines.splice(index + 1, 0, { ...lines[index], fromDate: "", toDate: "", fromQty: "", toQty: "" });
    patch({ lines } as never);
  };

  const save = async () => {
    setFormError(null);
    const parsed = (isCustomer ? customerPriceSchema : groupPriceSchema).safeParse(form);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) next[issue.path.join(".")] ??= issue.message;
      setErrors(next);
      setFormError(next.lines ?? "Please correct the highlighted fields.");
      return;
    }
    setSaving(true);
    try {
      if (isCustomer) await customerPriceApi.saveCustomer(form as CustomerPriceInput, setupId);
      else await customerPriceApi.saveGroup(form as GroupPriceInput, setupId);
      toast.success("Prices saved.");
      router.push(backHref);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const err = (key: string) => errors[key];
  const rowError = (index: number) => Object.entries(errors).find(([key]) => key.startsWith(`lines.${index}.`))?.[1];
  const g = form as GroupForm;
  const c = form as CustomerForm;

  return (
    <>
      <PageHead
        title={title}
        breadcrumbs={breadcrumbs}
        actions={
          <Link href={backHref} className={buttonClasses("secondary", "md")}>
            <ArrowLeft /> All Prices
          </Link>
        }
      />
      <form
        noValidate
        className="flex flex-col gap-4 pb-6"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {formError && <Notice tone="error">{formError}</Notice>}

        <Panel title={isCustomer ? "Basic Information" : "Customer Group Price"}>
          <FormGrid cols={4}>
            {options.businessUnits.length > 1 && (
              <Field label="Business Unit" required error={err("businessUnitId")}>
                {(id) => (
                  <Select
                    id={id}
                    value={unit}
                    disabled={!!setupId}
                    options={toOptions(options.businessUnits)}
                    onChange={(e) => patch({ businessUnitId: e.target.value, priceListId: "", customerId: "", officeId: "", customerGroupId: "", ...FILTER, lines: [] })}
                  />
                )}
              </Field>
            )}
            <Field label="Price Type" error={err("priceListId")}>
              {(id) => <Select id={id} value={form.priceListId} disabled={!unit} placeholder="Default" options={toOptions(of(options.priceLists))} onChange={(e) => patch({ priceListId: e.target.value })} />}
            </Field>
            {isCustomer ? (
              <Field label="Customer" required error={err("customerId")}>
                {(id) => (
                  <Select
                    id={id}
                    value={c.customerId}
                    disabled={!unit}
                    placeholder="Select customer…"
                    options={of(options.customers).map((customer) => ({ value: customer.id, label: `${customer.code} · ${customer.name}` }))}
                    aria-invalid={!!err("customerId") || undefined}
                    onChange={(e) => patch({ customerId: e.target.value })}
                  />
                )}
              </Field>
            ) : (
              <>
                <Field label="Office" required error={err("officeId")}>
                  {(id) => <Select id={id} value={g.officeId} disabled={!unit} options={toOptions(of(options.offices))} aria-invalid={!!err("officeId") || undefined} onChange={(e) => patch({ officeId: e.target.value })} />}
                </Field>
                <Field label="Customer Group" required error={err("customerGroupId")}>
                  {(id) => (
                    <Select id={id} value={g.customerGroupId} disabled={!unit} options={toOptions(of(options.customerGroups))} aria-invalid={!!err("customerGroupId") || undefined} onChange={(e) => patch({ customerGroupId: e.target.value })} />
                  )}
                </Field>
                <Field label="Create Date" required error={err("createDate")}>
                  {(id) => <Input id={id} type="date" value={g.createDate} onChange={(e) => patch({ createDate: e.target.value })} />}
                </Field>
                <Field label="Circular/Notice" error={err("circularNo")}>
                  {(id) => <Input id={id} value={g.circularNo} maxLength={100} onChange={(e) => patch({ circularNo: e.target.value })} />}
                </Field>
                <Field label="Remarks" span={2} error={err("remarks")}>
                  {(id) => <TextArea id={id} rows={1} value={g.remarks} maxLength={500} onChange={(e) => patch({ remarks: e.target.value })} />}
                </Field>
                <div className="flex items-end pb-1.5">
                  <Checkbox label="Is price running?" checked={g.isRunning} onChange={(e) => patch({ isRunning: e.target.checked })} />
                </div>
              </>
            )}
          </FormGrid>

          <PanelSection title="Items" className="mt-4">
            <FormGrid cols={4}>
              <Field label="Item Type">
                {(id) => <Select id={id} value={form.itemType} placeholder="All item types" options={ITEM_TYPES} onChange={(e) => patch({ itemType: e.target.value as CustomerForm["itemType"] })} />}
              </Field>
              <CategoryFields categories={of(options.categories)} disabled={!unit} value={form} onChange={(value) => patch(value)} />
            </FormGrid>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="accent-soft" disabled={!unit} onClick={() => addItems(matching.map((item) => item.id))} title="Add every item matching the filters">
                <ListPlus /> Add All Items ({matching.length})
              </Button>
              <Button disabled={form.lines.length === 0} onClick={() => patch({ lines: [] })}>
                <ListX /> Remove All
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <Select aria-label="Add one item" className="w-72" value={addItemId} disabled={!unit} placeholder="Add one item…" options={itemOptions(matching.filter((item) => !isCustomer || !inList.has(item.id)))} onChange={(e) => setAddItemId(e.target.value)} />
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
        </Panel>

        <Panel title="Item Prices" actions={<span className="text-xs text-ink-faint">{form.lines.length} row(s)</span>} flush>
          {form.lines.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-faint">No items yet. Use “Add All Items” or add one item.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-grid w-full min-w-[720px]">
                <thead>
                  <tr>
                    {(isCustomer ? ["SL", "Item", "DP Price", "TP Price", "Action"] : ["SL", "Item", "From Date", "To Date", "From Qty", "To Qty", "DP Price", "TP Price", "Action"]).map((header) => (
                      <th key={header} scope="col" className="px-2.5 py-2 text-left">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(form.lines as GroupForm["lines"]).map((line, index) => {
                    const item = itemById.get(line.itemId);
                    return (
                      <tr key={`${line.itemId}-${index}`}>
                        <td className="w-12 px-2.5 py-2 text-right align-top text-ink-faint tabular-nums">{index + 1}</td>
                        <td className="px-2.5 py-2 align-top">
                          <span className="font-medium text-ink">{item?.name ?? "—"}</span>
                          <span className="ml-1.5 text-xs text-ink-faint">{item?.code} · {item?.uom}</span>
                          {rowError(index) && <p className="mt-1 text-xs text-danger">{rowError(index)}</p>}
                        </td>
                        {!isCustomer && (
                          <>
                            <td className="w-40 px-2 py-1.5 align-top"><Input aria-label={`From date, row ${index + 1}`} type="date" value={line.fromDate} onChange={(e) => setLine(index, { fromDate: e.target.value })} /></td>
                            <td className="w-40 px-2 py-1.5 align-top"><Input aria-label={`To date, row ${index + 1}`} type="date" value={line.toDate} onChange={(e) => setLine(index, { toDate: e.target.value })} /></td>
                            <td className="w-28 px-2 py-1.5 align-top"><NumberInput label={`From qty, row ${index + 1}`} value={line.fromQty} pattern={QTY} onChange={(v) => setLine(index, { fromQty: v })} /></td>
                            <td className="w-28 px-2 py-1.5 align-top"><NumberInput label={`To qty, row ${index + 1}`} value={line.toQty} pattern={QTY} onChange={(v) => setLine(index, { toQty: v })} /></td>
                          </>
                        )}
                        <td className="w-32 px-2 py-1.5 align-top"><NumberInput label={`DP price, row ${index + 1}`} placeholder="0.00" value={line.dpPrice} pattern={MONEY} onChange={(v) => setLine(index, { dpPrice: v })} /></td>
                        <td className="w-32 px-2 py-1.5 align-top"><NumberInput label={`TP price, row ${index + 1}`} placeholder="0.00" value={line.tpPrice} pattern={MONEY} onChange={(v) => setLine(index, { tpPrice: v })} /></td>
                        <td className="w-24 px-1.5 py-1 text-center align-top whitespace-nowrap">
                          {!isCustomer && (
                            <Button variant="ghost" size="icon" className="hover:text-accent-strong" aria-label={`Copy row ${index + 1} for another slab`} title="Add a slab for this item" onClick={() => copyLine(index)}>
                              <CopyPlus />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="hover:text-danger" aria-label={`Remove row ${index + 1}`} title="Remove" onClick={() => removeLine(index)}>
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

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded border border-line bg-surface/95 px-4 py-2.5 shadow-xs backdrop-blur">
          <SaveState dirty={dirty} />
          <Link href={backHref} className={buttonClasses("secondary", "md")}>
            Cancel
          </Link>
          <Button type="submit" variant="accent" loading={saving}>
            {!saving && <Save />} Save Prices
          </Button>
        </div>
      </form>
    </>
  );
}
