"use client";

import { ArrowLeft, Paperclip, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { CONTROL, SelectField, TextField } from "@/components/ui/form-field";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { InventoryDocSlug, InventoryDocument } from "../schemas/document.schema";
import { inventoryApi, today, type DocumentInput, type InventoryMasters, type ItemOption } from "../services/inventory.api";

/** Lists a header field can choose from (loaded with the inventory masters). */
export type LookupKind = "employee" | "salesOrder" | "supplier" | "project" | "department" | "expenseHead" | "uom" | "office";
const LOOKUPS = new Set<string>(["employee", "salesOrder", "supplier", "project", "department", "expenseHead", "uom", "office"]);

/** One header field of an iBOS-style inventory form. */
export interface HeaderField {
  key: string;
  label: string;
  /**
   * "checkbox": a tick box in the top row (saved as "Yes"); "file": one PDF/image
   * uploaded at once (its attachment id is saved); "vehicle": a vehicle used before,
   * or "Add New" vehicle no and name.
   */
  kind: LookupKind | "text" | "number" | "select" | "date" | "checkbox" | "file" | "vehicle";
  /** Choices of a "select" field. */
  options?: readonly string[];
  required?: boolean;
  /** Shown only for these subtypes (e.g. gate in / gate out, employee / department). */
  when?: readonly string[];
  /** Shown only while this checkbox field is ticked. */
  whenChecked?: string;
  /** Saved as the document's party or reference instead of an extra (meta) field. */
  saveAs?: "partyName" | "reference";
  placeholder?: string;
  defaultValue?: string;
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
  /** iBOS conversion: one "From Item" turned into one or more items. */
  conversion?: boolean;
  /** Lines are optional (gate passes). */
  linesOptional?: boolean;
  /** The approved request this document can fulfil. */
  fulfils?: { slug: InventoryDocSlug; label: string };
  subtype?: { label: string; options: readonly string[]; radio?: boolean };
  fields?: readonly HeaderField[];
  /** Item picker: "full" (type → category → sub → minor → item), "supplier" (supplier instead of type), "simple" (item only). */
  picker?: "full" | "supplier" | "simple";
  /** Columns of the item grid. */
  columns?: readonly GridColumn[];
  /** Grid headings that differ from the defaults. */
  columnLabels?: Partial<Record<GridColumn, string>>;
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
const round3 = (v: number) => Math.round(v * 1000) / 1000;
const uniqSorted = (values: (string | null | undefined)[]) => [...new Set(values.filter((v): v is string => Boolean(v)))].sort();

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
  // "Save & New" starts a fresh form by remounting it.
  const [round, setRound] = useState(0);
  if (!open) return null;
  return (
    <FormPage onClose={onClose}>
      <DocumentForm
        key={round}
        config={config}
        onClose={onClose}
        onSaved={onSaved}
        onSaveNew={() => setRound((r) => r + 1)}
        initialRequestId={round === 0 ? initialRequestId : undefined}
      />
    </FormPage>
  );
}

/**
 * iBOS opens a create form as its own page, not a popup: the form takes the place
 * of the list (which stays mounted, so its filters survive) until Back or Save.
 */
function FormPage({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const [root] = useState(() => (typeof document === "undefined" ? null : document.querySelector<HTMLElement>(".inventory-module-root")));
  useEffect(() => {
    root?.classList.add("inv-form-open");
    window.scrollTo({ top: 0 });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !e.defaultPrevented && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      root?.classList.remove("inv-form-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [root, onClose]);
  const page = <div className="inv-form-page p-1">{children}</div>;
  return root ? createPortal(page, root) : page;
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
      return uniqSorted(masters.employees.map((e) => e.department)).map((d) => ({ value: d, label: d }));
    case "uom":
      return uniqSorted(masters.items.map((i) => i.uom)).map((u) => ({ value: u, label: u }));
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

/** Initial field values: defaults, and today for date fields. */
const initialValues = (fields: readonly HeaderField[] | undefined) =>
  Object.fromEntries((fields ?? []).flatMap((f) => (f.defaultValue ? [[f.key, f.defaultValue]] : f.kind === "date" ? [[f.key, today()]] : [])));

/**
 * Item Type (or Supplier) → Category → Sub Category → Minor Category → Select Item,
 * each narrowing the next (iBOS item picker).
 */
function ItemCascade({
  items,
  value,
  onChange,
  showType = true,
  supplier,
  labels,
  itemClassName = "sm:col-span-2",
  required,
}: {
  items: ItemOption[];
  value: string;
  onChange: (itemId: string) => void;
  showType?: boolean;
  supplier?: { value: string; onChange: (id: string) => void; options: { value: string; label: string }[] };
  labels?: { type?: string; category?: string; sub?: string; minor?: string };
  itemClassName?: string;
  required?: boolean;
}) {
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const [sub, setSub] = useState("");
  const [minor, setMinor] = useState("");
  const byType = items.filter((i) => !type || i.itemType === type);
  const byCategory = byType.filter((i) => !category || i.category === category);
  const bySub = byCategory.filter((i) => !sub || i.subCategory === sub);
  const pickable = bySub.filter((i) => !minor || i.minorCategory === minor);
  const reset = (level: number) => {
    if (level <= 1) setCategory("");
    if (level <= 2) setSub("");
    if (level <= 3) setMinor("");
  };
  return (
    <>
      {supplier ? (
        <SelectField label="Supplier" value={supplier.value} onChange={(e) => { supplier.onChange(e.target.value); reset(1); }} options={[{ value: "", label: "Select/Search Supplier" }, ...supplier.options]} />
      ) : (
        showType && (
          <SelectField
            label={labels?.type ?? "Item Type"}
            value={type}
            onChange={(e) => { setType(e.target.value); reset(1); }}
            options={[{ value: "", label: "All" }, ...uniqSorted(items.map((i) => i.itemType)).map((t) => ({ value: t, label: t }))]}
          />
        )
      )}
      {showType && (
        <>
          <SelectField label={labels?.category ?? "Category"} value={category} onChange={(e) => { setCategory(e.target.value); reset(2); }} options={[{ value: "", label: "Select" }, ...uniqSorted(byType.map((i) => i.category)).map((t) => ({ value: t, label: t }))]} />
          <SelectField label={labels?.sub ?? "Sub Category"} value={sub} onChange={(e) => { setSub(e.target.value); reset(3); }} options={[{ value: "", label: "Select" }, ...uniqSorted(byCategory.map((i) => i.subCategory)).map((t) => ({ value: t, label: t }))]} />
          <SelectField label={labels?.minor ?? "Minor Category"} value={minor} onChange={(e) => setMinor(e.target.value)} options={[{ value: "", label: "Minor Category" }, ...uniqSorted(bySub.map((i) => i.minorCategory)).map((t) => ({ value: t, label: t }))]} />
        </>
      )}
      <div className={itemClassName}>
        <SelectField
          label="Select Item"
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          options={[{ value: "", label: `Select item (${pickable.length})` }, ...pickable.map((i) => ({ value: i.id, label: `${i.code} - ${i.name} (${i.uom})` }))]}
        />
      </div>
    </>
  );
}

function DocumentForm({
  config,
  onClose,
  onSaved,
  onSaveNew,
  initialRequestId,
}: {
  config: DocumentFormConfig;
  onClose: () => void;
  onSaved: (doc: InventoryDocument) => void;
  onSaveNew: () => void;
  initialRequestId?: string;
}) {
  const saveAndNew = useRef(false);
  const toast = useToast();
  const masters = useResource("inventory-masters", inventoryApi.masters);
  const requests = useResource(config.fulfils ? `inventory-open-${config.fulfils.slug}` : null, () =>
    inventoryApi.list(config.fulfils!.slug, { status: "APPROVED" }),
  );
  const columns = config.columns ?? DEFAULT_COLUMNS;
  const picker = config.picker ?? "full";

  const [docDate, setDocDate] = useState(today());
  const [expectedDate, setExpectedDate] = useState(config.expectedDateLabel ? today() : "");
  const [officeId, setOfficeId] = useState("");
  const [toOfficeId, setToOfficeId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [requestId, setRequestId] = useState("");
  const [subtype, setSubtype] = useState(config.subtype?.options[0] ?? "");
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(config.fields));
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newVehicle, setNewVehicle] = useState(false);

  // Item picker.
  const [pickSupplier, setPickSupplier] = useState("");
  const [pickItem, setPickItem] = useState("");
  const [pickQty, setPickQty] = useState("");
  // Conversion: the item converted from and how much of it.
  const [fromItem, setFromItem] = useState("");
  const [requireQty, setRequireQty] = useState("");

  const data = masters.data;
  const warehouses = useMemo(() => data?.warehouses ?? [], [data]);
  const offices = useMemo(() => lookupOptions("office", data), [data]);
  const source = warehouses.find((w) => w.id === warehouseId);
  const target = warehouses.find((w) => w.id === toWarehouseId);
  const unitId = source?.businessUnitId ?? target?.businessUnitId;

  const isVisible = (f: HeaderField) => (!f.when || f.when.includes(subtype)) && (!f.whenChecked || values[f.whenChecked] === "Yes");
  const visibleFields = (config.fields ?? []).filter(isVisible);
  // "Supplier Wise" (a supplier header field) or the picker's supplier limits the items to what that supplier delivered.
  const supplierFilter = visibleFields.find((f) => f.kind === "supplier" && values[f.key])?.key;
  const supplierId = (supplierFilter ? values[supplierFilter] : "") || pickSupplier;

  // Items of the chosen warehouse's business unit (any unit until one is chosen).
  const unitItems = useMemo(() => (data?.items ?? []).filter((i) => !unitId || i.businessUnitId === unitId), [data, unitId]);
  const items = useMemo(() => unitItems.filter((i) => !supplierId || i.supplierIds.includes(supplierId)), [unitItems, supplierId]);
  const itemById = useMemo(() => new Map(unitItems.map((i) => [i.id, i])), [unitItems]);

  const stockWarehouseId = config.stockOf === "target" ? toWarehouseId : warehouseId;
  const stock = useResource(stockWarehouseId ? `inventory-stock-${stockWarehouseId}` : null, () => inventoryApi.stock(stockWarehouseId));
  const onHand = useMemo(() => new Map((stock.data ?? []).map((s) => [s.itemId, s.qty])), [stock.data]);

  const warehouseOptions = (office: string, placeholder: string, exclude?: string) => [
    { value: "", label: masters.loading ? "Loading…" : placeholder },
    ...warehouses
      .filter((w) => (!config.offices || !office || w.officeId === office) && w.id !== exclude)
      .map((w) => ({ value: w.id, label: config.offices ? w.name : `${w.name} · ${w.officeName}` })),
  ];
  const supplierOptions = useMemo(() => lookupOptions("supplier", data), [data]);

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
    // The request's user type and person fill the form (lookups are matched by name).
    const kind = request.subtype && config.subtype?.options.includes(request.subtype) ? request.subtype : subtype;
    if (kind !== subtype) setSubtype(kind);
    const partyField = (config.fields ?? []).find((f) => f.saveAs === "partyName" && (!f.when || f.when.includes(kind)));
    if (partyField && request.partyName) {
      const value = LOOKUPS.has(partyField.kind)
        ? (lookupOptions(partyField.kind as LookupKind, data).find((o) => lookupName(partyField.kind as LookupKind, o.value, data) === request.partyName)?.value ?? "")
        : request.partyName;
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
    if (config.conversion && pickItem === fromItem) return toast.error("Choose an item other than the From Item.");
    if (!config.signed && !(qty > 0)) return toast.error("Enter a quantity greater than 0.");
    if (config.signed && !qty) return toast.error("Enter the quantity (+ to add, − to remove).");
    setLines((all) => {
      const at = all.findIndex((l) => l.itemId === pickItem);
      if (at >= 0) return all.map((l, i) => (i === at ? { ...l, qty: String((Number(l.qty) || 0) + qty) } : l));
      return [...all, { itemId: pickItem, qty: String(qty), toItemId: "", toQty: "", remarks: "" }];
    });
    setPickItem("");
    setPickQty("");
  };

  const upload = async (key: string, file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const saved = await inventoryApi.uploadIssueAttachment(file);
      setValues((v) => ({ ...v, [key]: saved.id, [`${key}Name`]: saved.originalName }));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  /** Conversion lines: the From Item's quantity shared over the target items in proportion. */
  const conversionLines = () => {
    const from = Number(requireQty);
    const targets = lines.filter((l) => l.itemId && Number(l.qty) > 0);
    const total = targets.reduce((t, l) => t + Number(l.qty), 0);
    let left = from;
    return targets.map((l, i) => {
      const share = i === targets.length - 1 ? round3(left) : round3((from * Number(l.qty)) / total);
      left -= share;
      return { itemId: fromItem, qty: share, toItemId: l.itemId, toQty: Number(l.qty) };
    });
  };

  const submit = async () => {
    const missing = visibleFields.find((f) => f.required && !values[f.key]);
    if (missing) return toast.error(`Enter ${missing.label}.`);
    if (config.conversion) {
      if (!fromItem) return toast.error("Select the From Item.");
      if (!(Number(requireQty) > 0)) return toast.error("Enter the Require Qty.");
      if (!lines.length) return toast.error("Add the item(s) it converts into.");
      if (conversionLines().some((l) => !(l.qty > 0))) return toast.error("Require Qty is too small to share over these items.");
    } else if (!config.linesOptional && !lines.some((l) => l.itemId)) return toast.error("Add at least one item.");

    let partyName: string | undefined;
    let reference: string | undefined;
    const meta: Record<string, string> = {};
    for (const f of visibleFields) {
      const raw = values[f.key];
      if (!raw) continue;
      if (f.kind === "checkbox") {
        if (raw === "Yes") meta[f.key] = "Yes";
        continue;
      }
      if (f.kind === "file" || f.kind === "vehicle") {
        meta[f.key] = raw.slice(0, 200);
        const extra = f.kind === "file" ? `${f.key}Name` : "vehicleName";
        if (values[extra]) meta[extra] = values[extra].slice(0, 200);
        continue;
      }
      const isLookup = LOOKUPS.has(f.kind);
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
      lines: config.conversion
        ? conversionLines()
        : lines.filter((l) => l.itemId).map((l) => ({ itemId: l.itemId, qty: Number(l.qty), remarks: l.remarks || undefined })),
    };
    setSaving(true);
    try {
      const doc = await inventoryApi.create(config.slug, input);
      toast.success(`${doc.number} saved.`);
      onSaved(doc);
      if (saveAndNew.current) onSaveNew();
      else onClose();
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
    const set = (v: string) => setValues((all) => ({ ...all, [f.key]: v }));
    switch (f.kind) {
      case "checkbox":
        return null; // shown in the top row
      case "text":
      case "number":
      case "date":
        return (
          <TextField
            key={f.key}
            label={label}
            required={required}
            type={f.kind}
            step={f.kind === "number" ? "any" : undefined}
            value={value}
            maxLength={f.kind === "date" ? undefined : 200}
            placeholder={f.placeholder ?? f.label}
            onChange={(e) => set(e.target.value)}
          />
        );
      case "file":
        return (
          <div key={f.key} className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-muted">
              {label}
              {required && <span className="ml-0.5 text-danger">*</span>}
            </span>
            {value ? (
              <span className="inline-flex h-8 items-center gap-1.5 text-[12px]">
                <Paperclip className="size-3.5 text-ink-muted" aria-hidden />
                <span className="max-w-48 truncate" title={values[`${f.key}Name`]}>{values[`${f.key}Name`]}</span>
                <Button variant="ghost" size="icon" aria-label="Remove attachment" onClick={() => setValues((all) => ({ ...all, [f.key]: "", [`${f.key}Name`]: "" }))}>
                  <X className="size-3.5" />
                </Button>
              </span>
            ) : (
              <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded border border-dashed border-line-strong px-2.5 text-[12px] text-ink-muted hover:bg-canvas">
                {uploading ? <Spinner className="size-3.5" /> : <Paperclip className="size-3.5" aria-hidden />}
                {uploading ? "Uploading…" : "Attach PDF or image"}
                <input type="file" accept="image/*,application/pdf" className="sr-only" disabled={uploading} onChange={(e) => upload(f.key, e.target.files?.[0])} />
              </label>
            )}
          </div>
        );
      case "vehicle": {
        const vehicles = data?.vehicles ?? [];
        return newVehicle ? (
          <div key={f.key} className="contents">
            <TextField label="Vehicle No" required={required} value={value} maxLength={60} placeholder="Vehicle No" onChange={(e) => set(e.target.value)} />
            <div className="flex items-end gap-2">
              <TextField className="flex-1" label="Vehicle Name" value={values.vehicleName ?? ""} maxLength={100} placeholder="Vehicle Name" onChange={(e) => setValues((all) => ({ ...all, vehicleName: e.target.value }))} />
              <Button variant="ghost" onClick={() => { setNewVehicle(false); setValues((all) => ({ ...all, [f.key]: "", vehicleName: "" })); }}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div key={f.key} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-muted">{label}</span>
              <button type="button" onClick={() => { setNewVehicle(true); set(""); }} className="min-h-6 px-1 text-xs font-semibold text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30">
                Add New
              </button>
            </div>
            <select
              aria-label={label}
              value={value}
              onChange={(e) => {
                set(e.target.value);
                setValues((all) => ({ ...all, vehicleName: vehicles.find((v) => v.number === e.target.value)?.name ?? "" }));
              }}
              className={cn(CONTROL, "h-8")}
            >
              <option value="">Select Vehicle</option>
              {vehicles.map((v) => (
                <option key={v.number} value={v.number}>
                  {v.number}
                  {v.name ? ` - ${v.name}` : ""}
                </option>
              ))}
            </select>
          </div>
        );
      }
      default: {
        const options = f.kind === "select" ? (f.options ?? []).map((o) => ({ value: o, label: o })) : lookupOptions(f.kind, data);
        return <SelectField key={f.key} label={label} required={required} value={value} onChange={(e) => set(e.target.value)} options={[{ value: "", label: f.placeholder ?? f.label }, ...options]} />;
      }
    }
  };

  const checkboxes = (config.fields ?? []).filter((f) => f.kind === "checkbox");
  const totalQty = lines.reduce((t, l) => t + (Number(l.qty) || 0), 0);
  const headerCell = "px-2 py-2 text-left font-semibold whitespace-nowrap";
  const numCell = "px-2 py-1.5 text-right tabular-nums text-ink-muted whitespace-nowrap";
  const stockHint = (id: string) => (id && stockWarehouseId ? ` · Stock ${qtyText(onHand.get(id) ?? 0)}` : "");
  const conversionLabels = { type: "Item Type", category: "Item Category", sub: "Item Sub Category", minor: "Minor Category" };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 text-ink" aria-label={config.title}>
      {/* iBOS page header: ← title, Save & New, SAVE */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 shadow-2xs">
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" className="size-8" aria-label="Back to list" onClick={onClose}>
            <ArrowLeft className="!size-4.5" />
          </Button>
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{config.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" variant="accent-soft" disabled={saving || uploading} onClick={() => (saveAndNew.current = true)}>
            Save &amp; New
          </Button>
          <Button type="submit" variant="primary" className="min-w-20" loading={saving} disabled={uploading} onClick={() => (saveAndNew.current = false)}>
            SAVE
          </Button>
        </div>
      </div>
      {masters.error ? (
        <p className="rounded-lg border border-line bg-surface p-4 text-sm text-danger">{masters.error.message}</p>
      ) : (
        <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 shadow-2xs">
          {(config.subtype?.radio || checkboxes.length > 0) && (
            <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
              {config.subtype?.radio && (
                <div role="radiogroup" aria-label={config.subtype.label} className="flex flex-wrap gap-5">
                  {config.subtype.options.map((o) => (
                    <label key={o} className="inline-flex min-h-6 cursor-pointer items-center gap-2">
                      <input type="radio" name="inventory-subtype" value={o} checked={subtype === o} disabled={!!requestId} onChange={() => setSubtype(o)} className="size-4 accent-primary" />
                      {o}
                    </label>
                  ))}
                </div>
              )}
              {checkboxes.map((f) => (
                <label key={f.key} className="inline-flex min-h-6 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={values[f.key] === "Yes"}
                    onChange={(e) => setValues((all) => ({ ...all, [f.key]: e.target.checked ? "Yes" : "" }))}
                    className="size-4 accent-primary"
                  />
                  {f.label}
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
            {config.subtype && !config.subtype.radio && (
              <SelectField
                label={config.subtype.label}
                required={config.conversion}
                value={subtype}
                onChange={(e) => setSubtype(e.target.value)}
                options={config.subtype.options.map((o) => ({ value: o, label: o }))}
              />
            )}
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
            {config.expectedDateLabel && (
              <TextField label={config.expectedDateLabel} type="date" required value={expectedDate} min={docDate} onChange={(e) => setExpectedDate(e.target.value)} />
            )}
            {visibleFields.map(fieldControl)}
            <TextField label="Remarks" value={remarks} maxLength={500} placeholder="Remarks" onChange={(e) => setRemarks(e.target.value)} />
          </div>

          {config.conversion ? (
            <>
              {/* iBOS: From Item */}
              <section className="rounded border border-line bg-canvas/60 p-3">
                <h3 className="mb-2 text-sm font-semibold text-ink">From Item</h3>
                <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <ItemCascade items={unitItems} value={fromItem} onChange={setFromItem} labels={conversionLabels} required />
                  <TextField label="Current Avg Rate" value={fromItem ? money(itemById.get(fromItem)?.costPrice) : ""} placeholder="Current Avg Rate" readOnly disabled />
                  <TextField label={`Require Qty${stockHint(fromItem)}`} required type="number" step="any" min={0} value={requireQty} placeholder="Require Qty" onChange={(e) => setRequireQty(e.target.value)} />
                </div>
              </section>
              {/* iBOS: Item (what it converts into) */}
              <section className="rounded border border-line bg-canvas/60 p-3">
                <h3 className="mb-2 text-sm font-semibold text-ink">Item</h3>
                <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <ItemCascade items={unitItems.filter((i) => i.id !== fromItem)} value={pickItem} onChange={setPickItem} labels={conversionLabels} />
                  <TextField label="Current Avg Rate" value={pickItem ? money(itemById.get(pickItem)?.costPrice) : ""} placeholder="Current Avg Rate" readOnly disabled />
                  <TextField label="Qty" type="number" step="any" min={0} value={pickQty} placeholder="Qty" onChange={(e) => setPickQty(e.target.value)} />
                  <div>
                    <Button onClick={addPicked} disabled={!pickItem}>
                      <Plus /> Add
                    </Button>
                  </div>
                </div>
              </section>
              <div className="overflow-x-auto rounded border border-line">
                <table className="w-full text-sm">
                  <thead className="bg-blue-50 text-xs text-ink dark:bg-blue-500/10">
                    <tr>
                      <th className={cn(headerCell, "w-10")}>SL</th>
                      <th className={headerCell}>Item Code</th>
                      <th className={headerCell}>Item Name</th>
                      <th className={headerCell}>UoM</th>
                      <th className={cn(headerCell, "text-right")}>Current Avg Rate</th>
                      <th className={cn(headerCell, "text-right")}>Qty</th>
                      <th className={cn(headerCell, "w-14 text-center")}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-2 py-6 text-center text-xs text-ink-faint">
                          No data
                        </td>
                      </tr>
                    )}
                    {lines.map((line, index) => {
                      const item = itemById.get(line.itemId);
                      return (
                        <tr key={line.itemId} className="border-t border-line">
                          <td className="px-2 py-1.5 text-ink-muted">{index + 1}</td>
                          <td className="px-2 py-1.5 font-mono text-xs whitespace-nowrap">{item?.code ?? "—"}</td>
                          <td className="min-w-40 px-2 py-1.5">{item?.name ?? "—"}</td>
                          <td className="px-2 py-1.5 text-ink-muted">{item?.uom ?? "—"}</td>
                          <td className={numCell}>{money(item?.costPrice)}</td>
                          <td className="px-2 py-1.5 text-right">
                            <input aria-label={`Qty of ${item?.name ?? "item"}`} type="number" step="any" min={0} value={line.qty} onChange={(e) => setLine(index, { qty: e.target.value })} className={cn(CONTROL, "h-8 w-28 text-right")} />
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            <Button variant="ghost" size="icon" aria-label={`Remove ${item?.name ?? "line"}`} onClick={() => setLines(lines.filter((_, i) => i !== index))}>
                              <Trash2 className="size-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              {/* Item picker */}
              <div className="rounded border border-line bg-canvas/60 p-3">
                <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <ItemCascade
                    items={items}
                    value={pickItem}
                    onChange={setPickItem}
                    showType={picker !== "simple"}
                    supplier={picker === "supplier" ? { value: pickSupplier, onChange: setPickSupplier, options: supplierOptions } : undefined}
                    itemClassName={picker === "simple" ? "sm:col-span-2 lg:col-span-3" : "sm:col-span-2"}
                  />
                  <TextField
                    label={`${config.qtyLabel ?? "Quantity"}${stockHint(pickItem)}`}
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
                  <thead className="bg-blue-50 text-xs text-ink dark:bg-blue-500/10">
                    <tr>
                      <th className={cn(headerCell, "w-10")}>SL</th>
                      {columns.map((c) => (
                        <th key={c} className={cn(headerCell, ["cost", "trade", "mrp", "stock", "altQty", "qty", "amount"].includes(c) && "text-right")}>
                          {columnLabel(c, config)}
                        </th>
                      ))}
                      <th className={cn(headerCell, "w-14 text-center")}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.length === 0 && (
                      <tr>
                        <td colSpan={columns.length + 2} className="px-2 py-6 text-center text-xs text-ink-faint">
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
                        <td colSpan={columns.length - (columns.indexOf("qty") >= 0 ? columns.indexOf("qty") + 1 : columns.length) + 1} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </form>
  );
}

function columnLabel(c: GridColumn, config: DocumentFormConfig): string {
  const custom = config.columnLabels?.[c];
  if (custom) return custom;
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
