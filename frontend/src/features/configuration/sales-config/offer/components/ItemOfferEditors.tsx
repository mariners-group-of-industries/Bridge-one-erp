"use client";

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

export type ItemMultipleForm = Required<Omit<ItemMultipleOfferInput, "pairLines" | "bonusLines">> & {
  pairLines: Required<ItemMultipleOfferInput["pairLines"][number]>[];
  bonusLines: Required<ItemMultipleOfferInput["bonusLines"][number]>[];
};
type PairRow = ItemMultipleForm["pairLines"][number] & { subCategoryId?: string };
export const blankPairLine = (): ItemMultipleForm["pairLines"][number] => ({ categoryId: "", itemId: "", quantity: "", minQty: "", maxQty: "" });
export const blankBonusLine = (): ItemMultipleForm["bonusLines"][number] => ({ itemId: "", quantity: "" });

export function ItemMultipleOfferEditor({ form, patch, errors, options, unit, locked }: EditorProps<ItemMultipleForm> & { locked?: boolean }) {
  const o = unitOptions(options, unit);
  const level1 = o.categories.filter((c) => c.level === 1);
  const setPair = (index: number, changes: Partial<PairRow>) =>
    patch({ pairLines: form.pairLines.map((line, i) => (i === index ? { ...line, ...changes } : line)) });
  const setBonus = (index: number, changes: Partial<ItemMultipleForm["bonusLines"][number]>) =>
    patch({ bonusLines: form.bonusLines.map((line, i) => (i === index ? { ...line, ...changes } : line)) });
  // A row's "Sub Category" is whichever chosen category sits at level 2.
  const levelOf = (id: string) => o.categories.find((c) => c.id === id);
  const rootOf = (id: string) => {
    const category = levelOf(id);
    return category?.level === 2 ? (category.parentId ?? "") : id;
  };

  return (
    <>
      <Panel title="Create Offer: Item (Multiple)" description="Buy the selling items together (within the min/max quantities) to get the bonus items.">
        <HeaderFields options={options} form={form} patch={patch} errors={errors} datesRequired locked={locked}>
          <Field label="Price Type" error={errors.priceListId}>
            {(id) => <Select id={id} value={form.priceListId} disabled={!unit} placeholder="All price types" options={toOptions(o.priceLists)} onChange={(e) => patch({ priceListId: e.target.value })} />}
          </Field>
          <Field label="Based On" error={errors.basedOn}>
            {(id) => <Select id={id} value={form.basedOn} options={OFFER_BASED_ON} onChange={(e) => patch({ basedOn: e.target.value as ItemMultipleForm["basedOn"] })} />}
          </Field>
        </HeaderFields>
      </Panel>

      <Panel title="Selling Item" flush>
        {errors.pairLines && <div className="px-4 pt-3"><Notice tone="error">{errors.pairLines}</Notice></div>}
        <div className="overflow-x-auto">
          <table className="data-grid w-full min-w-[1000px]">
            <thead>
              <tr>
                {["SL", "Category", "Sub Category", "Item", "Qty", "Minimum Sales Qty", "Maximum Sales Qty", "Action"].map((header) => (
                  <th key={header} scope="col" className="px-2.5 py-2 text-left">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {form.pairLines.map((line, index) => {
                const root = rootOf(line.categoryId);
                const sub = levelOf(line.categoryId)?.level === 2 ? line.categoryId : "";
                const subs = o.categories.filter((c) => root && c.parentId === root);
                return (
                  <tr key={index}>
                    <td className="w-12 px-2.5 py-2 text-right align-top text-ink-faint tabular-nums">{index + 1}</td>
                    <FieldCell>
                      <Select aria-label={`Category, row ${index + 1}`} value={root} disabled={!unit} placeholder="All" options={toOptions(level1)} onChange={(e) => setPair(index, { categoryId: e.target.value, itemId: "" })} />
                    </FieldCell>
                    <FieldCell>
                      <Select aria-label={`Sub category, row ${index + 1}`} value={sub} disabled={!root} placeholder="All" options={toOptions(subs)} onChange={(e) => setPair(index, { categoryId: e.target.value || root, itemId: "" })} />
                    </FieldCell>
                    <FieldCell>
                      <Select aria-label={`Item, row ${index + 1}`} value={line.itemId} disabled={!unit} placeholder="Select item…" options={itemOptions(o.itemsIn(line.categoryId))} onChange={(e) => setPair(index, { itemId: e.target.value })} />
                      <CellError message={rowError(errors, "pairLines", index)} />
                    </FieldCell>
                    <FieldCell>
                      <NumberInput label={`Qty, row ${index + 1}`} value={line.quantity} pattern={QTY} onChange={(value) => setPair(index, { quantity: value })} />
                    </FieldCell>
                    <FieldCell>
                      <NumberInput label={`Minimum sales qty, row ${index + 1}`} value={line.minQty} pattern={QTY} onChange={(value) => setPair(index, { minQty: value })} />
                    </FieldCell>
                    <FieldCell>
                      <NumberInput label={`Maximum sales qty, row ${index + 1}`} value={line.maxQty} pattern={QTY} onChange={(value) => setPair(index, { maxQty: value })} />
                    </FieldCell>
                    <td className="px-1.5 py-1 align-top">
                      <RowButtons
                        index={index}
                        onAdd={() => patch({ pairLines: insertAfter(form.pairLines, index, blankPairLine()) })}
                        onRemove={() => patch({ pairLines: removeAt(form.pairLines, index, blankPairLine()) })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Bonus Item" flush>
        {errors.bonusLines && <div className="px-4 pt-3"><Notice tone="error">{errors.bonusLines}</Notice></div>}
        <div className="overflow-x-auto">
          <table className="data-grid w-full min-w-[640px]">
            <thead>
              <tr>
                {["SL", "Item Name", "Quantity", "Action"].map((header) => (
                  <th key={header} scope="col" className="px-2.5 py-2 text-left">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {form.bonusLines.map((line, index) => (
                <tr key={index}>
                  <td className="w-12 px-2.5 py-2 text-right align-top text-ink-faint tabular-nums">{index + 1}</td>
                  <FieldCell>
                    <Select aria-label={`Bonus item, row ${index + 1}`} value={line.itemId} disabled={!unit} placeholder="Select item…" options={itemOptions(o.items)} onChange={(e) => setBonus(index, { itemId: e.target.value })} />
                    <CellError message={rowError(errors, "bonusLines", index)} />
                  </FieldCell>
                  <FieldCell>
                    <NumberInput label={`Bonus quantity, row ${index + 1}`} value={line.quantity} pattern={QTY} onChange={(value) => setBonus(index, { quantity: value })} />
                  </FieldCell>
                  <td className="w-24 px-1.5 py-1 align-top">
                    <RowButtons
                      index={index}
                      onAdd={() => patch({ bonusLines: insertAfter(form.bonusLines, index, blankBonusLine()) })}
                      onRemove={() => patch({ bonusLines: removeAt(form.bonusLines, index, blankBonusLine()) })}
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
