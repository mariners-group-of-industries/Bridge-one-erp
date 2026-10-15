"use client";

import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { entityMasterDataBreadcrumbs } from "../../breadcrumbs";
import { CONTROL_CLASS, Field, FormGrid, Input, Notice, Panel, Select, TextArea } from "../../employee/components/kit";
import { entityMasterDataPaths } from "../../paths";
import { OPENING_ITEM_TYPES, openingStockSchema, type OpeningStockOptions } from "../schemas/item.schema";
import { itemApi } from "../services/item.api";

const BREADCRUMBS = [
  ...entityMasterDataBreadcrumbs(entityMasterDataPaths.itemProfile),
  { label: "Opening Stock", href: entityMasterDataPaths.itemOpeningStock },
];

interface Line {
  key: number;
  itemId: string;
  quantity: string;
  rate: string;
}

let nextKey = 1;
const blankLine = (): Line => ({ key: nextKey++, itemId: "", quantity: "", rate: "" });
const today = () => new Date().toISOString().slice(0, 10);
const money = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function OpeningStockView() {
  const options = useResource("opening-stock-options", itemApi.openingStockOptions);
  const [round, setRound] = useState(0);

  return (
    <PageContainer full>
      <PageHead
        title="Opening Stock"
        subtitle="Receive the opening quantity and cost of items into a warehouse."
        breadcrumbs={BREADCRUMBS}
        actions={
          <Link href={entityMasterDataPaths.itemProfile} className={buttonClasses("secondary", "md")}>
            <ArrowLeft /> Item Profile
          </Link>
        }
      />
      {options.error ? (
        <section className="rounded border border-line bg-surface">
          <ErrorState message={options.error.message} onRetry={options.reload} />
        </section>
      ) : !options.data ? (
        <section className="rounded border border-line bg-surface">
          <LoadingState label="Loading…" />
        </section>
      ) : (
        <OpeningStockEditor key={round} options={options.data} onSaved={() => setRound((value) => value + 1)} />
      )}
    </PageContainer>
  );
}

function OpeningStockEditor({ options, onSaved }: { options: OpeningStockOptions; onSaved: () => void }) {
  const toast = useToast();
  const [head, setHead] = useState({
    receiptDate: today(),
    officeId: options.offices.length === 1 ? options.offices[0].id : "",
    warehouseId: "",
    itemType: "INVENTORY" as "INVENTORY" | "ASSET",
    challanNo: "",
    remarks: "",
    creditAccountCode: "",
  });
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const setHeadField = (changes: Partial<typeof head>) => {
    setHead((current) => ({ ...current, ...changes }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(changes)) delete next[key];
      return next;
    });
  };

  const office = options.offices.find((o) => o.id === head.officeId);
  const warehouses = options.warehouses.filter((w) => w.officeId === head.officeId);
  const items = options.items.filter(
    (item) =>
      item.businessUnitId === office?.businessUnitId &&
      (head.itemType === "ASSET" ? item.itemType === "Asset" : item.itemType !== "Asset" && item.itemType !== "Service"),
  );
  const itemById = new Map(options.items.map((item) => [item.id, item]));
  const accountTypes = [...new Set(options.accounts.map((account) => account.type))];

  const setLine = (key: number, changes: Partial<Line>) => {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...changes } : line)));
    setErrors((current) => {
      const next = { ...current };
      for (const k of Object.keys(next)) if (k.startsWith("lines")) delete next[k];
      return next;
    });
  };
  const addLineAfter = (key: number) =>
    setLines((current) => {
      const index = current.findIndex((line) => line.key === key);
      return [...current.slice(0, index + 1), blankLine(), ...current.slice(index + 1)];
    });
  const removeLine = (key: number) => setLines((current) => (current.length === 1 ? [blankLine()] : current.filter((line) => line.key !== key)));

  const amountOf = (line: Line) => (Number(line.quantity) || 0) * (Number(line.rate) || 0);
  const totalQty = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
  const totalAmount = lines.reduce((sum, line) => sum + amountOf(line), 0);

  const save = async () => {
    setFormError(null);
    // Ignore completely empty rows.
    const filled = lines.filter((line) => line.itemId || line.quantity || line.rate);
    const payload = { ...head, lines: filled.map(({ itemId, quantity, rate }) => ({ itemId, quantity, rate })) };
    const parsed = openingStockSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[issue.path.join(".")] ??= issue.message;
      setErrors(next);
      setFormError(next.lines ?? "Please correct the highlighted fields.");
      return;
    }
    setSaving(true);
    try {
      const result = await itemApi.createOpeningStock(payload);
      toast.success(`Opening stock ${result.number} saved: ${result.lineCount} item${result.lineCount === 1 ? "" : "s"}, ${result.totalAmount}.`);
      onSaved();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const err = (key: string) => errors[key];

  return (
    <form
      noValidate
      className="flex flex-col gap-4 pb-6"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {formError && <Notice tone="error">{formError}</Notice>}

      <Panel title="Receive Details">
        <FormGrid cols={4}>
          <Field label="Create Date" required error={err("receiptDate")}>
            {(id) => <Input id={id} type="date" value={head.receiptDate} onChange={(e) => setHeadField({ receiptDate: e.target.value })} />}
          </Field>
          <Field label="Office" required error={err("officeId")}>
            {(id) => (
              <Select
                id={id}
                value={head.officeId}
                options={options.offices.map((o) => ({ value: o.id, label: o.name }))}
                aria-invalid={!!err("officeId") || undefined}
                onChange={(e) => {
                  setHeadField({ officeId: e.target.value, warehouseId: "" });
                  setLines([blankLine()]);
                }}
              />
            )}
          </Field>
          <Field label="Warehouse" required error={err("warehouseId")} hint={head.officeId ? undefined : "Select an office first."}>
            {(id) => (
              <Select
                id={id}
                value={head.warehouseId}
                disabled={!head.officeId}
                options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                aria-invalid={!!err("warehouseId") || undefined}
                onChange={(e) => setHeadField({ warehouseId: e.target.value })}
              />
            )}
          </Field>
          <Field label="Item Type" required error={err("itemType")}>
            {(id) => (
              <Select
                id={id}
                value={head.itemType}
                placeholder={false}
                options={OPENING_ITEM_TYPES}
                onChange={(e) => {
                  setHeadField({ itemType: e.target.value as "INVENTORY" | "ASSET" });
                  setLines([blankLine()]);
                }}
              />
            )}
          </Field>
          <Field label="Challan No" error={err("challanNo")}>
            {(id) => <Input id={id} value={head.challanNo} maxLength={50} onChange={(e) => setHeadField({ challanNo: e.target.value })} />}
          </Field>
          <Field label="Credit GL Account" error={err("creditAccountCode")} hint={options.accounts.length ? undefined : "No accounts in the chart of accounts yet."}>
            {(id) => (
              <select
                id={id}
                className={cn(CONTROL_CLASS, "pr-7")}
                value={head.creditAccountCode}
                disabled={options.accounts.length === 0}
                onChange={(e) => setHeadField({ creditAccountCode: e.target.value })}
              >
                <option value="">Select account…</option>
                {accountTypes.map((type) => (
                  <optgroup key={type} label={type.charAt(0) + type.slice(1).toLowerCase()}>
                    {options.accounts
                      .filter((account) => account.type === type)
                      .map((account) => (
                        <option key={account.code} value={account.code}>
                          {account.code} · {account.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            )}
          </Field>
          <Field label="Remarks" span={2} error={err("remarks")}>
            {(id) => <TextArea id={id} rows={1} value={head.remarks} maxLength={500} onChange={(e) => setHeadField({ remarks: e.target.value })} />}
          </Field>
        </FormGrid>
      </Panel>

      <Panel title="Items" description={office ? undefined : "Select an office to choose items."} flush>
        <div className="overflow-x-auto">
          <table className="data-grid w-full min-w-[760px]">
            <thead>
              <tr>
                <th scope="col" className="w-14 px-2.5 py-2 text-left">SL No</th>
                <th scope="col" className="px-2.5 py-2 text-left">Item</th>
                <th scope="col" className="w-40 px-2.5 py-2 text-right">Quantity</th>
                <th scope="col" className="w-40 px-2.5 py-2 text-right">Rate</th>
                <th scope="col" className="w-44 px-2.5 py-2 text-right">Total Amount</th>
                <th scope="col" className="w-24 px-2.5 py-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const item = itemById.get(line.itemId);
                const rowError = err(`lines.${index}.itemId`) ?? err(`lines.${index}.quantity`) ?? err(`lines.${index}.rate`);
                return (
                  <tr key={line.key}>
                    <td className="px-2.5 py-2 text-right text-ink-faint tabular-nums">{index + 1}</td>
                    <td className="px-2 py-1.5">
                      <Select
                        aria-label={`Item, row ${index + 1}`}
                        value={line.itemId}
                        disabled={!office}
                        placeholder={items.length ? "Select item…" : "No items of this type"}
                        options={items.map((option) => ({ value: option.id, label: `${option.code} · ${option.name}` }))}
                        aria-invalid={!!err(`lines.${index}.itemId`) || undefined}
                        onChange={(e) => setLine(line.key, { itemId: e.target.value })}
                      />
                      {rowError && <p className="mt-1 text-xs text-danger">{rowError}</p>}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <Input
                          aria-label={`Quantity, row ${index + 1}`}
                          inputMode="decimal"
                          className="text-right tabular-nums"
                          value={line.quantity}
                          aria-invalid={!!err(`lines.${index}.quantity`) || undefined}
                          onChange={(e) =>
                            (item?.noDecimal ? /^\d{0,11}$/ : /^\d{0,11}(\.\d{0,3})?$/).test(e.target.value) && setLine(line.key, { quantity: e.target.value })
                          }
                        />
                        {item && <span className="shrink-0 text-xs text-ink-faint">{item.uom}</span>}
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        aria-label={`Rate, row ${index + 1}`}
                        inputMode="decimal"
                        placeholder="0.00"
                        className="text-right tabular-nums"
                        value={line.rate}
                        aria-invalid={!!err(`lines.${index}.rate`) || undefined}
                        onChange={(e) => /^\d{0,12}(\.\d{0,2})?$/.test(e.target.value) && setLine(line.key, { rate: e.target.value })}
                      />
                    </td>
                    <td className="px-2.5 py-2 text-right font-medium text-ink tabular-nums">{money(amountOf(line))}</td>
                    <td className="px-1.5 py-1 text-center whitespace-nowrap">
                      <Button variant="ghost" size="icon" className="hover:text-accent-strong" aria-label={`Add a row after row ${index + 1}`} title="Add row" onClick={() => addLineAfter(line.key)}>
                        <Plus />
                      </Button>
                      <Button variant="ghost" size="icon" className="hover:text-danger" aria-label={`Delete row ${index + 1}`} title="Delete row" onClick={() => removeLine(line.key)}>
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-canvas font-semibold text-ink">
                <td colSpan={2} className="border-t border-grid-line px-2.5 py-2 text-right text-xs uppercase">Total</td>
                <td className="border-t border-grid-line px-2.5 py-2 text-right tabular-nums">{totalQty.toLocaleString("en-US", { maximumFractionDigits: 3 })}</td>
                <td className="border-t border-grid-line" />
                <td className="border-t border-grid-line px-2.5 py-2 text-right tabular-nums">{money(totalAmount)}</td>
                <td className="border-t border-grid-line" />
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded border border-line bg-surface/95 px-4 py-2.5 shadow-xs backdrop-blur">
        <p className="mr-auto text-xs text-ink-faint">
          {lines.filter((line) => line.itemId).length} item(s) · Total {money(totalAmount)}
        </p>
        <Link href={entityMasterDataPaths.itemProfile} className={buttonClasses("secondary", "md")}>
          Cancel
        </Link>
        <Button type="submit" variant="accent" loading={saving}>
          {!saving && <Save />} Save Opening Stock
        </Button>
      </div>
    </form>
  );
}
