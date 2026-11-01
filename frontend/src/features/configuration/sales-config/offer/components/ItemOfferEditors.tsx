"use client";

import { ChevronDown, ChevronsDownUp, ChevronsUpDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormGrid, Notice, Panel, PanelSection, Select } from "@/features/configuration/entity-master-data/employee/components/kit";
import { OFFER_BASED_ON, type ItemMultipleOfferInput, type ItemOfferInput } from "../schemas/offer.schema";
import {
  CategoryFields,
  CellError,
  FieldCell,
  HeaderFields,
  insertAfter,
  itemOptions,
  NumberInput,
  QTY,
  removeAt,
  RowButtons,
  rowError,
  toOptions,
  unitOptions,
  uomsOf,
  type EditorProps,
} from "./offer-form-kit";

// ─── Items tab ────────────────────────────────────────────────────────────────

export type ItemForm = Required<Omit<ItemOfferInput, "lines">> & { lines: Required<ItemOfferInput["lines"][number]>[] };
export const blankItemLine = (): ItemForm["lines"][number] => ({ sellingItemId: "", sellingUom: "", sellingQty: "", offerItemId: "", offerUom: "", offerQty: "" });

export function ItemOfferEditor({ form, patch, errors, options, unit, locked }: EditorProps<ItemForm> & { locked?: boolean }) {
  const o = unitOptions(options, unit);
  const filterCategory = form.minorCategoryId || form.subCategoryId || form.categoryId;
  const sellingItems = o.itemsIn(filterCategory);
  const setLine = (index: number, changes: Partial<ItemForm["lines"][number]>) =>
    patch({ lines: form.lines.map((line, i) => (i === index ? { ...line, ...changes } : line)) });
  const pickItem = (index: number, side: "selling" | "offer", itemId: string) => {
    const uom = uomsOf(o.itemById.get(itemId))[0] ?? "";
    setLine(index, side === "selling" ? { sellingItemId: itemId, sellingUom: uom } : { offerItemId: itemId, offerUom: uom });
  };

  return (
    <>
      <Panel title="Create Offer: Items" description="Buy the selling item in the given quantity, get the offer item free.">
        <HeaderFields options={options} form={form} patch={patch} errors={errors} locked={locked}>
          <Field label="Customer Group" error={errors.customerGroupId}>
            {(id) => (
              <Select id={id} value={form.customerGroupId} disabled={!unit} placeholder="All customer groups" options={toOptions(o.customerGroups)} onChange={(e) => patch({ customerGroupId: e.target.value })} />
            )}
          </Field>
        </HeaderFields>
        <PanelSection title="Selling Item Filter" className="mt-4">
          <FormGrid cols={3}>
            <CategoryFields
              categories={o.categories}
              labelPrefix="Selling Item "
              disabled={!unit}
              value={form}
              onChange={(value) => patch(value)}
            />
          </FormGrid>
        </PanelSection>
      </Panel>

      <Panel title="Item List" flush>
        {errors.lines && <div className="px-4 pt-3"><Notice tone="error">{errors.lines}</Notice></div>}
        <div className="overflow-x-auto">
          <table className="data-grid w-full min-w-[1000px]">
            <thead>
              <tr>
                <th scope="col" rowSpan={2} className="w-14 px-2.5 py-2 text-left">SL No</th>
                <th scope="col" colSpan={3} className="px-2.5 py-2 text-center">Selling Item</th>
                <th scope="col" colSpan={3} className="px-2.5 py-2 text-center">Offer Item</th>
                <th scope="col" rowSpan={2} className="w-24 px-2.5 py-2 text-center">Action</th>
              </tr>
              <tr>
                {["Item", "UoM", "Qty", "Item", "UoM", "Qty"].map((header, i) => (
                  <th key={i} scope="col" className="px-2.5 py-2 text-left">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {form.lines.map((line, index) => (
                <tr key={index}>
                  <td className="px-2.5 py-2 text-right align-top text-ink-faint tabular-nums">{index + 1}</td>
                  <FieldCell>
                    <Select aria-label={`Selling item, row ${index + 1}`} value={line.sellingItemId} disabled={!unit} placeholder="Select item…" options={itemOptions(sellingItems)} onChange={(e) => pickItem(index, "selling", e.target.value)} />
                    <CellError message={rowError(errors, "lines", index)} />
                  </FieldCell>
                  <FieldCell>
                    <Select aria-label={`Selling UoM, row ${index + 1}`} className="w-24" value={line.sellingUom} placeholder="UoM" options={uomsOf(o.itemById.get(line.sellingItemId))} onChange={(e) => setLine(index, { sellingUom: e.target.value })} />
                  </FieldCell>
                  <FieldCell>
                    <NumberInput label={`Selling qty, row ${index + 1}`} value={line.sellingQty} pattern={QTY} onChange={(value) => setLine(index, { sellingQty: value })} />
                  </FieldCell>
                  <FieldCell>
                    <Select aria-label={`Offer item, row ${index + 1}`} value={line.offerItemId} disabled={!unit} placeholder="Select item…" options={itemOptions(o.items)} onChange={(e) => pickItem(index, "offer", e.target.value)} />
                  </FieldCell>
                  <FieldCell>
                    <Select aria-label={`Offer UoM, row ${index + 1}`} className="w-24" value={line.offerUom} placeholder="UoM" options={uomsOf(o.itemById.get(line.offerItemId))} onChange={(e) => setLine(index, { offerUom: e.target.value })} />
                  </FieldCell>
                  <FieldCell>
                    <NumberInput label={`Offer qty, row ${index + 1}`} value={line.offerQty} pattern={QTY} onChange={(value) => setLine(index, { offerQty: value })} />
                  </FieldCell>
                  <td className="px-1.5 py-1 align-top">
                    <RowButtons
                      index={index}
                      onAdd={() => patch({ lines: insertAfter(form.lines, index, blankItemLine()) })}
                      onRemove={() => patch({ lines: removeAt(form.lines, index, blankItemLine()) })}
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

// ─── Item (Multiple) tab ──────────────────────────────────────────────────────


type PairInput = ItemMultipleOfferInput["pairs"][number];
type BonusRow = Required<PairInput["bonusLines"][number]>;
/** One pair; `all` is the "All" box (every item of the category), kept in the form only. */
export type PairForm = Required<Omit<PairInput, "bonusLines">> & { bonusLines: BonusRow[]; all?: boolean };
export type ItemMultipleForm = Required<Omit<ItemMultipleOfferInput, "pairs" | "basedOn">> & { basedOn: ItemMultipleOfferInput["basedOn"] | ""; pairs: PairForm[] };
export const blankBonusLine = (): BonusRow => ({ itemId: "", quantity: "" });
export const blankPair = (): PairForm => ({ categoryId: "", itemId: "", quantity: "", minQty: "", maxQty: "", bonusLines: [blankBonusLine()], all: false });

/** Item (Multiple), as in Managerium: pairs, each a selling item (or a whole category) and its bonus items. */
export function ItemMultipleOfferEditor({ form, patch, errors, options, unit, locked }: EditorProps<ItemMultipleForm> & { locked?: boolean }) {
  const o = unitOptions(options, unit);
  const level1 = o.categories.filter((c) => c.level === 1);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const setPair = (index: number, changes: Partial<PairForm>) => patch({ pairs: form.pairs.map((pair, i) => (i === index ? { ...pair, ...changes } : pair)) });
  const setBonus = (index: number, row: number, changes: Partial<BonusRow>) =>
    setPair(index, { bonusLines: form.pairs[index].bonusLines.map((line, i) => (i === row ? { ...line, ...changes } : line)) });
  // A pair's "Sub Category" is whichever chosen category sits at level 2.
  const levelOf = (id: string) => o.categories.find((c) => c.id === id);
  const rootOf = (id: string) => {
    const category = levelOf(id);
    return category?.level === 2 ? (category.parentId ?? "") : id;
  };
  const toggle = (index: number) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  const err = (index: number, field: string) => errors[`pairs.${index}.${field}`];
  /** "All" is ticked, or a saved pair has a category and no item. */
  const isAll = (pair: PairForm) => pair.all ?? (!pair.itemId && !!pair.categoryId);

  return (
    <>
      <Panel title="Create Offer: Item (Multiple)" description="Each pair: buy the selling item (or any items of a category with All) within the min/max to get its bonus items.">
        <HeaderFields options={options} form={form} patch={patch} errors={errors} datesRequired locked={locked}>
          <Field label="Price Type" required={form.basedOn === "Price Type"} error={errors.priceListId}>
            {(id) => <Select id={id} value={form.priceListId} disabled={!unit} placeholder="Price Type" options={toOptions(o.priceLists)} onChange={(e) => patch({ priceListId: e.target.value })} />}
          </Field>
          <Field label="Based On" required error={errors.basedOn}>
            {(id) => <Select id={id} value={form.basedOn} placeholder="Based On" options={OFFER_BASED_ON} onChange={(e) => patch({ basedOn: e.target.value as ItemMultipleForm["basedOn"] })} />}
          </Field>
        </HeaderFields>
      </Panel>

      <div className="flex flex-wrap items-center justify-end gap-1">
        {errors.pairs && (
          <div className="mr-auto">
            <Notice tone="error">{errors.pairs}</Notice>
          </div>
        )}
        <Button variant="ghost" size="icon" aria-label="Expand all pairs" title="Expand all" onClick={() => setCollapsed(new Set())}>
          <ChevronsUpDown />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Collapse all pairs" title="Collapse all" onClick={() => setCollapsed(new Set(form.pairs.map((_, i) => i)))}>
          <ChevronsDownUp />
        </Button>
        <Button variant="accent" onClick={() => patch({ pairs: [...form.pairs, blankPair()] })}>
          <Plus /> New Pair
        </Button>
      </div>

      {form.pairs.map((pair, index) => {
        const open = !collapsed.has(index);
        const all = isAll(pair);
        const root = rootOf(pair.categoryId);
        const sub = levelOf(pair.categoryId)?.level === 2 ? pair.categoryId : "";
        const subs = o.categories.filter((c) => root && c.parentId === root);
        // A different category keeps the chosen item only when it still belongs to it.
        const keepItem = (categoryId: string) => (pair.itemId && o.itemsIn(categoryId).some((item) => item.id === pair.itemId) ? pair.itemId : "");
        return (
          <section key={index} aria-label={`Pair ${index + 1}`} className="rounded border border-line bg-surface">
            <header className="flex items-center gap-2 border-b border-line px-3 py-2">
              <button type="button" aria-expanded={open} onClick={() => toggle(index)} className="flex items-center gap-1.5 text-sm font-semibold text-ink hover:text-accent-strong">
                {open ? <ChevronUp className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
                Pair {index + 1}
              </button>
              {form.pairs.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto hover:text-danger"
                  aria-label={`Remove pair ${index + 1}`}
                  title="Remove pair"
                  onClick={() => {
                    patch({ pairs: form.pairs.filter((_, i) => i !== index) });
                    setCollapsed(new Set());
                  }}
                >
                  <Trash2 />
                </Button>
              )}
            </header>
            {open && (
              <div className="flex flex-col gap-4 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-base font-semibold text-ink">Selling Item</h3>
                  <p className="text-xs text-ink-faint italic">With All ticked, every item of the chosen Category / Sub Category counts.</p>
                </div>
                <FormGrid cols={3}>
                  <Field label="Category">
                    {(id) => (
                      <Select id={id} value={root} disabled={!unit} placeholder="Select Category" options={toOptions(level1)} onChange={(e) => setPair(index, { categoryId: e.target.value, itemId: keepItem(e.target.value) })} />
                    )}
                  </Field>
                  <Field label="Sub Category">
                    {(id) => (
                      <Select
                        id={id}
                        value={sub}
                        disabled={!root}
                        placeholder="Sub Category"
                        options={toOptions(subs)}
                        onChange={(e) => setPair(index, { categoryId: e.target.value || root, itemId: keepItem(e.target.value || root) })}
                      />
                    )}
                  </Field>
                  <Field label="Item" error={err(index, "itemId")}>
                    {(id) => (
                      <div className="flex items-center gap-2">
                        <Select
                          id={id}
                          className="min-w-0 flex-1"
                          value={all ? "" : pair.itemId}
                          disabled={!unit || all}
                          placeholder={all ? "All items of the category" : "Select item…"}
                          options={itemOptions(o.itemsIn(pair.categoryId))}
                          onChange={(e) => setPair(index, { itemId: e.target.value, all: false })}
                        />
                        <label className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-muted">
                          <input type="checkbox" checked={all} disabled={!unit} onChange={(e) => setPair(index, { all: e.target.checked, itemId: "" })} className="size-4 accent-(--accent-strong)" />
                          All
                        </label>
                      </div>
                    )}
                  </Field>
                  <Field label="Quantity" required error={err(index, "quantity")}>
                    {() => <NumberInput label={`Quantity, pair ${index + 1}`} value={pair.quantity} pattern={QTY} invalid={!!err(index, "quantity")} onChange={(value) => setPair(index, { quantity: value })} />}
                  </Field>
                  <Field label="Minimum Sales Quantity" error={err(index, "minQty")}>
                    {() => <NumberInput label={`Minimum sales quantity, pair ${index + 1}`} value={pair.minQty} pattern={QTY} onChange={(value) => setPair(index, { minQty: value })} />}
                  </Field>
                  <Field label="Maximum Sales Quantity" error={err(index, "maxQty")}>
                    {() => <NumberInput label={`Maximum sales quantity, pair ${index + 1}`} value={pair.maxQty} pattern={QTY} onChange={(value) => setPair(index, { maxQty: value })} />}
                  </Field>
                </FormGrid>

                <div className="flex flex-col gap-2 border-t border-line pt-3">
                  <h3 className="text-base font-semibold text-ink">Bonus Item</h3>
                  {err(index, "bonusLines") && <Notice tone="error">{err(index, "bonusLines")}</Notice>}
                  <div className="max-w-3xl overflow-x-auto">
                    <table className="data-grid w-full min-w-[560px]">
                      <thead>
                        <tr>
                          {["SL", "Item Name", "Quantity", "Action"].map((header) => (
                            <th key={header} scope="col" className="px-2.5 py-2 text-left">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pair.bonusLines.map((line, row) => (
                          <tr key={row}>
                            <td className="w-12 px-2.5 py-2 text-right align-top text-ink-faint tabular-nums">{row + 1}</td>
                            <FieldCell>
                              <Select aria-label={`Bonus item ${row + 1}, pair ${index + 1}`} value={line.itemId} disabled={!unit} placeholder="Select/Search Item" options={itemOptions(o.items)} onChange={(e) => setBonus(index, row, { itemId: e.target.value })} />
                              <CellError message={rowError(errors, `pairs.${index}.bonusLines`, row)} />
                            </FieldCell>
                            <FieldCell>
                              <NumberInput label={`Bonus quantity ${row + 1}, pair ${index + 1}`} value={line.quantity} pattern={QTY} onChange={(value) => setBonus(index, row, { quantity: value })} />
                            </FieldCell>
                            <td className="w-24 px-1.5 py-1 align-top">
                              <RowButtons
                                index={row}
                                onAdd={() => setPair(index, { bonusLines: insertAfter(pair.bonusLines, row, blankBonusLine()) })}
                                onRemove={() => setPair(index, { bonusLines: removeAt(pair.bonusLines, row, blankBonusLine()) })}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}
