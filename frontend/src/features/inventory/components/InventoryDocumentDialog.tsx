"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { CONTROL, SelectField, TextField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { InventoryDocSlug, InventoryDocument } from "../schemas/document.schema";
import { inventoryApi, today, type DocumentInput, type InventoryMasters, type ItemOption } from "../services/inventory.api";

/** Lists a header field can choose from (loaded with the inventory masters). */
export type LookupKind = "employee" | "salesOrder" | "supplier" | "project" | "department" | "expenseHead" | "uom" | "office";

/** One header field of an iBOS-style inventory form. */
export interface HeaderField {
  key: string;
  label: string;
  kind: LookupKind | "text" | "number" | "select";
  /** Choices of a "select" field. */
  options?: readonly string[];
  required?: boolean;
  /** Shown only for these subtypes (e.g. gate in / gate out). */
  when?: readonly string[];
  /** Saved as the document's party or reference instead of an extra (meta) field. */
  saveAs?: "partyName" | "reference";
  placeholder?: string;
}

export type GridColumn = "code" | "category" | "name" | "cost" | "trade" | "mrp" | "stock" | "altUom" | "altQty" | "uom" | "qty" | "amount" | "remarks";

/** What a page's "Create" form asks for; the API checks the same rules. */
export interface DocumentFormConfig {
  slug: InventoryDocSlug;
  title: string;
  /** "one": one warehouse; "two": from and to; "target": only the requesting warehouse; "none": no warehouse (gate passes). */
  warehouses: "one" | "two" | "target" | "none";
  /** An Office select before each warehouse narrows the warehouses (iBOS). */
  offices?: boolean;
  officeLabel?: string;
  warehouseLabel?: string;
  toOfficeLabel?: string;
  toWarehouseLabel?: string;
  dateLabel?: string;
  expectedDateLabel?: string;
  /** Lines may add (+) or remove (−) stock: stock updates. */
  signed?: boolean;
  /** Each line turns an item into another one: conversions. */
  conversion?: boolean;
  /** Lines are optional (gate passes). */
  linesOptional?: boolean;
  /** The approved request this document can fulfil. */
  fulfils?: { slug: InventoryDocSlug; label: string };
  subtype?: { label: string; options: readonly string[]; radio?: boolean };
  fields?: readonly HeaderField[];
  /** Columns of the item grid. */
  columns?: readonly GridColumn[];
  /** Whose stock the grid shows: the source (default) or the requesting warehouse. */
  stockOf?: "source" | "target";
  qtyLabel?: string;
  stockLabel?: string;
}

interface Line {
  itemId: string;
  qty: string;
  toItemId: string;
  toQty: string;
  remarks: string;
}

const DEFAULT_COLUMNS: readonly GridColumn[] = ["code", "name", "uom", "stock", "qty"];
const money = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const qtyText = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 3 });

export function InventoryDocumentDialog({
  open,
  onClose,
  config,
  onSaved,
  initialRequestId,
}: {
  open: boolean;
  onClose: () => void;
  config: DocumentFormConfig;
  onSaved: (doc: InventoryDocument) => void;
  /** Opens with this approved request already chosen. */
  initialRequestId?: string;
}) {
  return open ? <DocumentForm config={config} onClose={onClose} onSaved={onSaved} initialRequestId={initialRequestId} /> : null;
}

/** Choices of a lookup field as { value, label }; the value is what the field keeps. */
function lookupOptions(kind: LookupKind, masters: InventoryMasters | undefined): { value: string; label: string }[] {
  if (!masters) return [];
  switch (kind) {
    case "employee":
      return masters.employees.map((e) => ({ value: e.id, label: `${e.name} (${e.code})` }));
    case "salesOrder":
      return masters.salesOrders.map((s) => ({ value: s.id, label: s.number }));
    case "supplier":
      return masters.suppliers.map((s) => ({ value: s.id, label: `${s.code} - ${s.name}` }));
    case "project":
      return masters.projects.map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` }));
    case "expenseHead":
      return masters.expenseHeads.map((a) => ({ value: a.id, label: `${a.code} - ${a.name}` }));
    case "department":
      return [...new Set(masters.employees.map((e) => e.department).filter((d): d is string => Boolean(d)))].sort().map((d) => ({ value: d, label: d }));
    case "uom":
      return [...new Set(masters.items.map((i) => i.uom).filter(Boolean))].sort().map((u) => ({ value: u, label: u }));
    case "office":
      return [...new Map(masters.warehouses.map((w) => [w.officeId, w.officeName])).entries()].map(([id, name]) => ({ value: id, label: name }));
  }
}

/** The name a lookup value stands for (employees and suppliers keep their name, not the code). */
function lookupName(kind: LookupKind, value: string, masters: InventoryMasters | undefined): string {
  if (!masters || !value) return value;
  switch (kind) {
    case "employee":
      return masters.employees.find((e) => e.id === value)?.name ?? value;
    case "supplier":
      return masters.suppliers.find((s) => s.id === value)?.name ?? value;
    default:
      return lookupOptions(kind, masters).find((o) => o.value === value)?.label ?? value;
  }
}

function DocumentForm({
  config,
  onClose,
  onSaved,
  initialRequestId,
}: {
  config: DocumentFormConfig;
  onClose: () => void;
  onSaved: (doc: InventoryDocument) => void;
  initialRequestId?: string;
}) {
  const toast = useToast();
  const masters = useResource("inventory-masters", inventoryApi.masters);
  const requests = useResource(config.fulfils ? `inventory-open-${config.fulfils.slug}` : null, () =>
    inventoryApi.list(config.fulfils!.slug, { status: "APPROVED" }),
  );
  const columns = config.columns ?? DEFAULT_COLUMNS;

  const [docDate, setDocDate] = useState(today());
  const [expectedDate, setExpectedDate] = useState(config.expectedDateLabel ? today() : "");
  const [officeId, setOfficeId] = useState("");
  const [toOfficeId, setToOfficeId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [requestId, setRequestId] = useState("");
  const [subtype, setSubtype] = useState(config.subtype?.options[0] ?? "");
  const [values, setValues] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);

  // Item picker (iBOS: type → category → sub → minor → item → quantity → Add).
  const [pickType, setPickType] = useState("");
  const [pickCategory, setPickCategory] = useState("");
  const [pickSub, setPickSub] = useState("");
  const [pickMinor, setPickMinor] = useState("");
  const [pickItem, setPickItem] = useState("");
  const [pickQty, setPickQty] = useState("");

  const data = masters.data;
  const warehouses = useMemo(() => data?.warehouses ?? [], [data]);
  const offices = useMemo(() => lookupOptions("office", data), [data]);
  const source = warehouses.find((w) => w.id === warehouseId);
  const target = warehouses.find((w) => w.id === toWarehouseId);
  const unitId = source?.businessUnitId ?? target?.businessUnitId;
  // Items of the chosen warehouse's business unit (any unit until one is chosen).
  const items = useMemo(() => (data?.items ?? []).filter((i) => !unitId || i.businessUnitId === unitId), [data, unitId]);
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const stockWarehouseId = config.stockOf === "target" ? toWarehouseId : warehouseId;
  const stock = useResource(stockWarehouseId ? `inventory-stock-${stockWarehouseId}` : null, () => inventoryApi.stock(stockWarehouseId));
  const onHand = useMemo(() => new Map((stock.data ?? []).map((s) => [s.itemId, s.qty])), [stock.data]);

  const warehouseOptions = (office: string, placeholder: string, exclude?: string) => [
    { value: "", label: masters.loading ? "Loading…" : placeholder },
    ...warehouses
      .filter((w) => (!config.offices || !office || w.officeId === office) && w.id !== exclude)
      .map((w) => ({ value: w.id, label: config.offices ? w.name : `${w.name} · ${w.officeName}` })),
  ];

  // Picker choices narrow one another.
  const typeOptions = useMemo(() => [...new Set(items.map((i) => i.itemType).filter((t): t is string => Boolean(t)))].sort(), [items]);
  const byType = items.filter((i) => !pickType || i.itemType === pickType);
  const categoryOptions = [...new Set(byType.map((i) => i.category))].sort();
  const byCategory = byType.filter((i) => !pickCategory || i.category === pickCategory);
  const subOptions = [...new Set(byCategory.map((i) => i.subCategory).filter((s): s is string => Boolean(s)))].sort();
  const bySub = byCategory.filter((i) => !pickSub || i.subCategory === pickSub);
  const minorOptions = [...new Set(bySub.map((i) => i.minorCategory).filter((s): s is string => Boolean(s)))].sort();
  const pickable = bySub.filter((i) => !pickMinor || i.minorCategory === pickMinor);

  const pickRequest = (id: string) => {
    setRequestId(id);
    const request = requests.data?.find((r) => r.id === id);
    if (!request) return;
    // Fill warehouses and the open quantity of each requested item.
    const from = warehouses.find((w) => w.id === request.warehouse?.id);
    const to = warehouses.find((w) => w.id === request.toWarehouse?.id);
    setWarehouseId(from?.id ?? "");
    setOfficeId(from?.officeId ?? "");
    setToWarehouseId(to?.id ?? "");
    setToOfficeId(to?.officeId ?? "");
    // The request's person fills the form's party field (an employee is matched by name).
    const partyField = (config.fields ?? []).find((f) => f.saveAs === "partyName");
    if (partyField && request.partyName) {
      const value = partyField.kind === "employee" ? (data?.employees.find((e) => e.name === request.partyName)?.id ?? "") : request.partyName;
      setValues((v) => ({ ...v, [partyField.key]: value }));
    }
    setLines(
      request.lines
        .filter((l) => l.qty - l.processedQty > 0)
        .map((l) => ({ itemId: l.itemId, qty: String(l.qty - l.processedQty), toItemId: "", toQty: "", remarks: "" })),
    );
  };

  // Pick the request the form was opened for, once the requests have loaded.
  const [prefilled, setPrefilled] = useState(false);
  if (initialRequestId && !prefilled && requests.data && masters.data) {
    setPrefilled(true);
    pickRequest(initialRequestId);
  }

  const setLine = (index: number, patch: Partial<Line>) => setLines((all) => all.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  const addPicked = () => {
    const qty = Number(pickQty);
    if (!pickItem) return toast.error("Select the item.");
    if (!config.signed && !(qty > 0)) return toast.error("Enter a quantity greater than 0.");
    if (config.signed && !qty) return toast.error("Enter the quantity (+ to add, − to remove).");
    setLines((all) => {
      const at = all.findIndex((l) => l.itemId === pickItem);
      if (at >= 0 && !config.conversion) return all.map((l, i) => (i === at ? { ...l, qty: String((Number(l.qty) || 0) + qty) } : l));
      return [...all, { itemId: pickItem, qty: String(qty), toItemId: "", toQty: "", remarks: "" }];
    });
    setPickItem("");
    setPickQty("");
  };

  const visibleFields = (config.fields ?? []).filter((f) => !f.when || f.when.includes(subtype));

  const submit = async () => {
    const missing = visibleFields.find((f) => f.required && !values[f.key]);
    if (missing) return toast.error(`Enter ${missing.label}.`);
    if (!config.linesOptional && !lines.some((l) => l.itemId)) return toast.error("Add at least one item.");

    let partyName: string | undefined;
    let reference: string | undefined;
    const meta: Record<string, string> = {};
    for (const f of visibleFields) {
      const raw = values[f.key];
      if (!raw) continue;
      const isLookup = !["text", "number", "select"].includes(f.kind);
      const shown = isLookup ? lookupName(f.kind as LookupKind, raw, data) : raw;
      if (f.saveAs === "partyName") partyName = shown;
      else if (f.saveAs === "reference") reference = shown;
      else meta[f.key] = shown.slice(0, 200);
      // Keep the record id of a lookup next to its name.
      if (isLookup && f.kind !== "department" && f.kind !== "uom") meta[`${f.key}Id`] = raw;
    }
    if (config.offices && officeId) meta.officeName = offices.find((o) => o.value === officeId)?.label ?? "";

    const input: DocumentInput = {
      docDate,
      expectedDate: expectedDate || undefined,
      warehouseId: warehouseId || undefined,
      toWarehouseId: toWarehouseId || undefined,
      requestId: requestId || undefined,
      subtype: subtype || undefined,
      partyName,
      reference,
      remarks: remarks || undefined,
      meta: Object.keys(meta).length ? meta : undefined,
      lines: lines
        .filter((l) => l.itemId)
        .map((l) => ({
          itemId: l.itemId,
          qty: Number(l.qty),
          remarks: l.remarks || undefined,
          ...(config.conversion ? { toItemId: l.toItemId || undefined, toQty: Number(l.toQty) || undefined } : {}),
        })),
    };
    setSaving(true);
    try {
      const doc = await inventoryApi.create(config.slug, input);
      toast.success(`${doc.number} saved.`);
      onSaved(doc);
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const fieldControl = (f: HeaderField) => {
    const label = f.label;
    const required = !!f.required;
    const value = values[f.key] ?? "";
    const set = (v: string) => setValues({ ...values, [f.key]: v });
    if (f.kind === "text" || f.kind === "number") {
      return (
        <TextField
          key={f.key}
          label={label}
          required={required}
          type={f.kind === "number" ? "number" : "text"}
          step={f.kind === "number" ? "any" : undefined}
          value={value}
          maxLength={200}
          placeholder={f.placeholder ?? f.label}
          onChange={(e) => set(e.target.value)}
        />
      );
    }
    const options = f.kind === "select" ? (f.options ?? []).map((o) => ({ value: o, label: o })) : lookupOptions(f.kind, data);
    return <SelectField key={f.key} label={label} required={required} value={value} onChange={(e) => set(e.target.value)} options={[{ value: "", label: f.placeholder ?? f.label }, ...options]} />;
  };

  const totalQty = lines.reduce((t, l) => t + (Number(l.qty) || 0), 0);
  const headerCell = "px-2 py-2 text-left font-semibold whitespace-nowrap";
  const numCell = "px-2 py-1.5 text-right tabular-nums text-ink-muted whitespace-nowrap";

  return (
    <Dialog
      open
      size="2xl"
      title={config.title}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            Save
          </Button>
        </>
      }
    >
      {masters.error ? (
        <p className="text-sm text-danger">{masters.error.message}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {config.subtype?.radio && (
            <div role="radiogroup" aria-label={config.subtype.label} className="flex flex-wrap gap-5 text-sm">
              {config.subtype.options.map((o) => (
                <label key={o} className="inline-flex min-h-6 cursor-pointer items-center gap-2">
                  <input type="radio" name="inventory-subtype" value={o} checked={subtype === o} onChange={() => setSubtype(o)} className="size-4 accent-primary" />
                  {o}
                </label>
              ))}
            </div>
          )}

          {/* Header */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {config.fulfils && (
              <SelectField
                label={config.fulfils.label}
                value={requestId}
                onChange={(e) => pickRequest(e.target.value)}
                options={[
                  { value: "", label: requests.loading ? "Loading…" : "None (direct)" },
                  ...(requests.data ?? []).map((r) => ({ value: r.id, label: `${r.number}${r.partyName ? ` · ${r.partyName}` : ""}` })),
                ]}
              />
            )}
            <TextField label={config.dateLabel ?? "Date"} type="date" required value={docDate} onChange={(e) => setDocDate(e.target.value)} />
            {(config.warehouses === "one" || config.warehouses === "two") && (
              <>
                {config.offices && (
                  <SelectField
                    label={config.officeLabel ?? "Office"}
                    required
                    value={officeId}
                    disabled={!!requestId && !!warehouseId}
                    onChange={(e) => {
                      setOfficeId(e.target.value);
                      setWarehouseId("");
                    }}
                    options={[{ value: "", label: config.officeLabel ?? "Office" }, ...offices]}
                  />
                )}
                <SelectField
                  label={config.warehouseLabel ?? "Warehouse"}
                  required
                  value={warehouseId}
                  disabled={!!requestId && !!source && !!requests.data?.find((r) => r.id === requestId)?.warehouse}
                  onChange={(e) => {
                    setWarehouseId(e.target.value);
                    // Picking a warehouse first fills in its office.
                    const w = warehouses.find((x) => x.id === e.target.value);
                    if (w && config.offices && !officeId) setOfficeId(w.officeId);
                  }}
                  options={warehouseOptions(officeId, config.warehouseLabel ?? "Warehouse")}
                />
              </>
            )}
            {(config.warehouses === "two" || config.warehouses === "target") && (
              <>
                {config.offices && (
                  <SelectField
                    label={config.toOfficeLabel ?? "To Office"}
                    required
                    value={toOfficeId}
                    disabled={!!requestId}
                    onChange={(e) => {
                      setToOfficeId(e.target.value);
                      setToWarehouseId("");
                    }}
                    options={[{ value: "", label: config.toOfficeLabel ?? "To Office" }, ...offices]}
                  />
                )}
                <SelectField
                  label={config.toWarehouseLabel ?? "To Warehouse"}
                  required
                  value={toWarehouseId}
                  disabled={!!requestId}
                  onChange={(e) => {
                    setToWarehouseId(e.target.value);
                    const w = warehouses.find((x) => x.id === e.target.value);
                    if (w && config.offices && !toOfficeId) setToOfficeId(w.officeId);
                  }}
                  options={warehouseOptions(toOfficeId, config.toWarehouseLabel ?? "To Warehouse", warehouseId)}
                />
              </>
            )}
            {config.subtype && !config.subtype.radio && (
              <SelectField
                label={config.subtype.label}
                value={subtype}
                onChange={(e) => setSubtype(e.target.value)}
                options={config.subtype.options.map((o) => ({ value: o, label: o }))}
              />
            )}
            {config.expectedDateLabel && (
              <TextField label={config.expectedDateLabel} type="date" required value={expectedDate} min={docDate} onChange={(e) => setExpectedDate(e.target.value)} />
            )}
            {visibleFields.map(fieldControl)}
            <TextField label="Remarks" value={remarks} maxLength={500} placeholder="Remarks" onChange={(e) => setRemarks(e.target.value)} />
          </div>

          {/* Item picker */}
          <div className="rounded border border-line bg-canvas/60 p-3">
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <SelectField
                label="Item Type"
                value={pickType}
                onChange={(e) => {
                  setPickType(e.target.value);
                  setPickCategory("");
                  setPickSub("");
                  setPickMinor("");
                }}
                options={[{ value: "", label: "All" }, ...typeOptions.map((t) => ({ value: t, label: t }))]}
              />
              <SelectField
                label="Category"
                value={pickCategory}
                onChange={(e) => {
                  setPickCategory(e.target.value);
                  setPickSub("");
                  setPickMinor("");
                }}
                options={[{ value: "", label: "Select" }, ...categoryOptions.map((t) => ({ value: t, label: t }))]}
              />
              <SelectField
                label="Sub Category"
                value={pickSub}
                onChange={(e) => {
                  setPickSub(e.target.value);
                  setPickMinor("");
                }}
                options={[{ value: "", label: "Select" }, ...subOptions.map((t) => ({ value: t, label: t }))]}
              />
              <SelectField
                label="Minor Category"
                value={pickMinor}
                onChange={(e) => setPickMinor(e.target.value)}
                options={[{ value: "", label: "Minor Category" }, ...minorOptions.map((t) => ({ value: t, label: t }))]}
              />
              <div className="sm:col-span-2">
                <SelectField
                  label="Select Item"
                  value={pickItem}
                  onChange={(e) => setPickItem(e.target.value)}
                  options={[{ value: "", label: `Select item (${pickable.length})` }, ...pickable.map((i) => ({ value: i.id, label: `${i.code} - ${i.name} (${i.uom})` }))]}
                />
              </div>
              <TextField
                label={`${config.qtyLabel ?? "Quantity"}${pickItem && stockWarehouseId ? ` · Stock ${qtyText(onHand.get(pickItem) ?? 0)}` : ""}`}
                type="number"
                step="any"
                value={pickQty}
                placeholder={config.signed ? "+ add / − remove" : "Quantity"}
                onChange={(e) => setPickQty(e.target.value)}
              />
              <div>
                <Button onClick={addPicked} disabled={!pickItem}>
                  <Plus /> Add
                </Button>
              </div>
            </div>
          </div>

          {/* Item grid */}
          <div className="overflow-x-auto rounded border border-line">
            <table className="w-full text-sm">
              <thead className="bg-canvas text-xs text-ink-muted">
                <tr>
                  <th className={cn(headerCell, "w-10")}>SL</th>
                  {columns.map((c) => (
                    <th key={c} className={cn(headerCell, ["cost", "trade", "mrp", "stock", "altQty", "qty", "amount"].includes(c) && "text-right")}>
                      {columnLabel(c, config)}
                    </th>
                  ))}
                  {config.conversion && <th className={headerCell}>Converted Item</th>}
                  {config.conversion && <th className={cn(headerCell, "text-right")}>Converted Qty</th>}
                  <th className={cn(headerCell, "w-14 text-center")}>Action</th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={columns.length + (config.conversion ? 4 : 2)} className="px-2 py-6 text-center text-xs text-ink-faint">
                      No data{config.linesOptional ? " — add items if goods pass the gate." : ""}
                    </td>
                  </tr>
                )}
                {lines.map((line, index) => {
                  const item = itemById.get(line.itemId);
                  return (
                    <tr key={`${line.itemId}-${index}`} className="border-t border-line">
                      <td className="px-2 py-1.5 text-ink-muted">{index + 1}</td>
                      {columns.map((c) => (
                        <GridCell key={c} column={c} item={item} line={line} stock={onHand.get(line.itemId) ?? 0} hasStock={!!stockWarehouseId} numCell={numCell} signed={config.signed} onChange={(patch) => setLine(index, patch)} />
                      ))}
                      {config.conversion && (
                        <td className="px-2 py-1.5">
                          <select aria-label="Converted item" value={line.toItemId} onChange={(e) => setLine(index, { toItemId: e.target.value })} className={cn(CONTROL, "h-8 min-w-48")}>
                            <option value="">Select item</option>
                            {items
                              .filter((i) => i.id !== line.itemId)
                              .map((i) => (
                                <option key={i.id} value={i.id}>
                                  {i.code} - {i.name}
                                </option>
                              ))}
                          </select>
                        </td>
                      )}
                      {config.conversion && (
                        <td className="px-2 py-1.5">
                          <input aria-label="Converted quantity" type="number" step="any" min={0} value={line.toQty} onChange={(e) => setLine(index, { toQty: e.target.value })} className={cn(CONTROL, "h-8 w-28 text-right")} />
                        </td>
                      )}
                      <td className="px-1 py-1.5 text-center">
                        <Button variant="ghost" size="icon" aria-label={`Remove ${item?.name ?? "line"}`} onClick={() => setLines(lines.filter((_, i) => i !== index))}>
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {lines.length > 0 && (
                <tfoot>
                  <tr className="border-t border-line bg-canvas font-semibold">
                    <td colSpan={columns.indexOf("qty") >= 0 ? columns.indexOf("qty") + 1 : columns.length + 1} className="px-2 py-2 text-right">
                      Total
                    </td>
                    {columns.indexOf("qty") >= 0 && <td className="px-2 py-2 text-right tabular-nums">{qtyText(totalQty)}</td>}
                    <td colSpan={columns.length - (columns.indexOf("qty") >= 0 ? columns.indexOf("qty") + 1 : columns.length) + (config.conversion ? 3 : 1)} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function columnLabel(c: GridColumn, config: DocumentFormConfig): string {
  switch (c) {
    case "code":
      return "Item Code";
    case "category":
      return "Item Category";
    case "name":
      return "Item Name";
    case "cost":
      return "Cost Price";
    case "trade":
      return "Trade Price";
    case "mrp":
      return "MRP Price";
    case "stock":
      return config.stockLabel ?? "Stock";
    case "altUom":
      return "Alt. UoM";
    case "altQty":
      return `Alt. ${config.qtyLabel ?? "Quantity"}`;
    case "uom":
      return "UoM";
    case "qty":
      return config.qtyLabel ?? "Quantity";
    case "amount":
      return "Amount";
    case "remarks":
      return "Remarks";
  }
}

function GridCell({
  column,
  item,
  line,
  stock,
  hasStock,
  numCell,
  signed,
  onChange,
}: {
  column: GridColumn;
  item: ItemOption | undefined;
  line: Line;
  stock: number;
  hasStock: boolean;
  numCell: string;
  signed?: boolean;
  onChange: (patch: Partial<Line>) => void;
}) {
  const qty = Number(line.qty) || 0;
  switch (column) {
    case "code":
      return <td className="px-2 py-1.5 font-mono text-xs whitespace-nowrap">{item?.code ?? "—"}</td>;
    case "category":
      return <td className="px-2 py-1.5 whitespace-nowrap text-ink-muted">{item?.category ?? "—"}</td>;
    case "name":
      return <td className="px-2 py-1.5 min-w-40">{item?.name ?? "—"}</td>;
    case "cost":
      return <td className={numCell}>{money(item?.costPrice)}</td>;
    case "trade":
      return <td className={numCell}>{money(item?.tradePrice)}</td>;
    case "mrp":
      return <td className={numCell}>{money(item?.mrp)}</td>;
    case "stock":
      return <td className={numCell}>{hasStock ? qtyText(stock) : "—"}</td>;
    case "altUom":
      return <td className="px-2 py-1.5 whitespace-nowrap text-ink-muted">{item?.altUom ?? "—"}</td>;
    case "altQty":
      // Quantity in the alternate unit: qty ÷ factor (as in sales and production).
      return <td className={numCell}>{item?.altUom && item.altUomFactor ? qtyText(Math.round((qty / item.altUomFactor) * 1000) / 1000) : "—"}</td>;
    case "uom":
      return <td className="px-2 py-1.5 whitespace-nowrap text-ink-muted">{item?.uom ?? "—"}</td>;
    case "qty":
      return (
        <td className="px-2 py-1.5">
          <input
            aria-label={`Quantity of ${item?.name ?? "item"}`}
            type="number"
            step="any"
            min={signed ? undefined : 0}
            value={line.qty}
            onChange={(e) => onChange({ qty: e.target.value })}
            className={cn(CONTROL, "h-8 w-28 text-right")}
          />
        </td>
      );
    case "amount":
      return <td className={numCell}>{money(item?.costPrice != null ? Math.round(item.costPrice * qty * 100) / 100 : null)}</td>;
    case "remarks":
      return (
        <td className="px-2 py-1.5">
          <input aria-label={`Remarks for ${item?.name ?? "item"}`} value={line.remarks} maxLength={300} onChange={(e) => onChange({ remarks: e.target.value })} placeholder="Remarks" className={cn(CONTROL, "h-8 min-w-32")} />
        </td>
      );
  }
}
