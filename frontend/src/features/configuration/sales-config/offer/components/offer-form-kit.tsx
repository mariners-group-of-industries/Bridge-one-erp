"use client";

import { Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormGrid, Input, Select } from "@/features/configuration/entity-master-data/employee/components/kit";
import type { OfferOptions } from "../schemas/offer.schema";

/** Errors keyed by schema path ("lines.0.amount"). */
export type Errors = Record<string, string>;

export interface EditorProps<T> {
  form: T;
  patch: (changes: Partial<T>) => void;
  errors: Errors;
  options: OfferOptions;
  /** Business unit of the offer ("" until chosen). */
  unit: string;
}

/** Options of one business unit, plus helpers shared by every offer form. */
export function unitOptions(options: OfferOptions, unit: string) {
  const of = <T extends { businessUnitId: string }>(list: T[]) => list.filter((row) => row.businessUnitId === unit);
  const categories = of(options.categories);
  const items = of(options.items);
  /** Ids of a category and every category below it. */
  const descendants = (id: string) => {
    const ids = new Set([id]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const category of categories) {
        if (category.parentId && ids.has(category.parentId) && !ids.has(category.id)) {
          ids.add(category.id);
          grew = true;
        }
      }
    }
    return ids;
  };
  return {
    customerGroups: of(options.customerGroups),
    priceLists: of(options.priceLists),
    suppliers: of(options.suppliers),
    categories,
    items,
    itemById: new Map(options.items.map((item) => [item.id, item])),
    /** Items under the deepest selected category (all items when none). */
    itemsIn: (categoryId: string) => {
      if (!categoryId) return items;
      const ids = descendants(categoryId);
      return items.filter((item) => item.categoryId && ids.has(item.categoryId));
    },
  };
}

export const toOptions = (list: { id: string; name: string }[]) => list.map((row) => ({ value: row.id, label: row.name }));
export const itemOptions = (list: { id: string; code: string; name: string }[]) =>
  list.map((item) => ({ value: item.id, label: `${item.code} · ${item.name}` }));

/** UoMs an item can be sold in: its base unit and its alt. unit. */
export function uomsOf(item: { uom: string; altUom: string | null } | undefined) {
  if (!item) return [];
  return [item.uom, ...(item.altUom && item.altUom !== item.uom ? [item.altUom] : [])];
}

export const QTY = /^\d{0,11}(\.\d{0,3})?$/;
export const MONEY = /^\d{0,14}(\.\d{0,2})?$/;
export const PERCENT = /^\d{0,3}(\.\d{0,2})?$/;

/** Business unit (only when there are several), offer name and dates. */
export function HeaderFields({
  options,
  form,
  patch,
  errors,
  datesRequired,
  locked,
  children,
}: {
  options: OfferOptions;
  form: { businessUnitId: string; name: string; fromDate?: string; toDate?: string };
  patch: (changes: { businessUnitId?: string; name?: string; fromDate?: string; toDate?: string }) => void;
  errors: Errors;
  datesRequired?: boolean;
  /** Business unit can't change once saved. */
  locked?: boolean;
  children?: ReactNode;
}) {
  return (
    <FormGrid cols={4}>
      {options.businessUnits.length > 1 && (
        <Field label="Business Unit" required error={errors.businessUnitId}>
          {(id) => (
            <Select
              id={id}
              value={form.businessUnitId}
              disabled={locked}
              options={toOptions(options.businessUnits)}
              onChange={(e) => patch({ businessUnitId: e.target.value })}
            />
          )}
        </Field>
      )}
      <Field label="Offer Name" required error={errors.name}>
        {(id) => <Input id={id} value={form.name} maxLength={150} aria-invalid={!!errors.name || undefined} onChange={(e) => patch({ name: e.target.value })} />}
      </Field>
      <Field label="From Date" required={datesRequired} error={errors.fromDate}>
        {(id) => <Input id={id} type="date" value={form.fromDate ?? ""} aria-invalid={!!errors.fromDate || undefined} onChange={(e) => patch({ fromDate: e.target.value })} />}
      </Field>
      <Field label="To Date" required={datesRequired} error={errors.toDate}>
        {(id) => <Input id={id} type="date" value={form.toDate ?? ""} aria-invalid={!!errors.toDate || undefined} onChange={(e) => patch({ toDate: e.target.value })} />}
      </Field>
      {children}
    </FormGrid>
  );
}

/** Category → Sub Category → Minor Category cascade. */
export function CategoryFields({
  categories,
  value,
  onChange,
  labelPrefix = "",
  disabled,
}: {
  categories: { id: string; name: string; parentId: string | null; level: number }[];
  value: { categoryId: string; subCategoryId: string; minorCategoryId: string };
  onChange: (value: { categoryId: string; subCategoryId: string; minorCategoryId: string }) => void;
  labelPrefix?: string;
  disabled?: boolean;
}) {
  const level1 = categories.filter((c) => c.level === 1);
  const level2 = categories.filter((c) => value.categoryId && c.parentId === value.categoryId);
  const level3 = categories.filter((c) => value.subCategoryId && c.parentId === value.subCategoryId);
  return (
    <>
      <Field label={`${labelPrefix}Category`}>
        {(id) => (
          <Select
            id={id}
            value={value.categoryId}
            disabled={disabled}
            placeholder="All categories"
            options={toOptions(level1)}
            onChange={(e) => onChange({ categoryId: e.target.value, subCategoryId: "", minorCategoryId: "" })}
          />
        )}
      </Field>
      <Field label={`${labelPrefix}Sub Category`}>
        {(id) => (
          <Select
            id={id}
            value={value.subCategoryId}
            disabled={disabled || !value.categoryId}
            placeholder="All sub categories"
            options={toOptions(level2)}
            onChange={(e) => onChange({ ...value, subCategoryId: e.target.value, minorCategoryId: "" })}
          />
        )}
      </Field>
      <Field label={`${labelPrefix}Minor Category`}>
        {(id) => (
          <Select
            id={id}
            value={value.minorCategoryId}
            disabled={disabled || !value.subCategoryId}
            placeholder="All minor categories"
            options={toOptions(level3)}
            onChange={(e) => onChange({ ...value, minorCategoryId: e.target.value })}
          />
        )}
      </Field>
    </>
  );
}

/** Add-row / delete-row buttons of a line table. */
export function RowButtons({ index, onAdd, onRemove }: { index: number; onAdd: () => void; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-center gap-0.5 whitespace-nowrap">
      <Button variant="ghost" size="icon" className="hover:text-accent-strong" aria-label={`Add a row after row ${index + 1}`} title="Add row" onClick={onAdd}>
        <Plus />
      </Button>
      <Button variant="ghost" size="icon" className="hover:text-danger" aria-label={`Delete row ${index + 1}`} title="Delete row" onClick={onRemove}>
        <Trash2 />
      </Button>
    </div>
  );
}

/** Inline error under a table cell. */
export function CellError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs text-danger">{message}</p> : null;
}

/** Insert a blank row after index / remove index (keeping at least one row). */
export function insertAfter<T>(rows: T[], index: number, blank: T): T[] {
  return [...rows.slice(0, index + 1), blank, ...rows.slice(index + 1)];
}
export function removeAt<T>(rows: T[], index: number, blank: T): T[] {
  return rows.length === 1 ? [blank] : rows.filter((_, i) => i !== index);
}

/** First error of a row, for showing under the row. */
export function rowError(errors: Errors, prefix: string, index: number) {
  const key = Object.keys(errors).find((k) => k.startsWith(`${prefix}.${index}.`));
  return key ? errors[key] : undefined;
}

export function FieldCell({ children }: { children: ReactNode }) {
  return <td className="px-2 py-1.5 align-top">{children}</td>;
}

export function NumberInput({
  value,
  onChange,
  pattern,
  label,
  invalid,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  pattern: RegExp;
  label: string;
  invalid?: boolean;
  placeholder?: string;
}) {
  return (
    <Input
      aria-label={label}
      inputMode="decimal"
      className="text-right tabular-nums"
      value={value}
      placeholder={placeholder}
      aria-invalid={invalid || undefined}
      onChange={(e) => pattern.test(e.target.value) && onChange(e.target.value)}
    />
  );
}
