"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { CONTROL, SelectField, TextAreaField, TextField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { InventoryDocSlug, InventoryDocument } from "../schemas/document.schema";
import { inventoryApi, today, type DocumentInput } from "../services/inventory.api";

/** What a page's "Create" form asks for; the API checks the same rules. */
export interface DocumentFormConfig {
  slug: InventoryDocSlug;
  title: string;
  /** "one": one warehouse; "two": from and to; "none": no warehouse (gate passes). */
  warehouses: "one" | "two" | "none";
  warehouseLabel?: string;
  toWarehouseLabel?: string;
  /** Lines may add (+) or remove (−) stock: stock updates. */
  signed?: boolean;
  /** Each line turns an item into another one: conversions. */
  conversion?: boolean;
  /** Lines are optional (gate passes). */
  linesOptional?: boolean;
  /** The approved request this document can fulfil. */
  fulfils?: { slug: InventoryDocSlug; label: string };
  subtype?: { label: string; options: readonly string[] };
  partyLabel?: string;
  referenceLabel?: string;
  expectedDateLabel?: string;
  /** Extra fields; `when` limits one to some subtypes. */
  meta?: readonly { key: string; label: string; when?: readonly string[] }[];
}

interface Line {
  itemId: string;
  qty: string;
  toItemId: string;
  toQty: string;
}

const emptyLine = (): Line => ({ itemId: "", qty: "", toItemId: "", toQty: "" });

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

  const [docDate, setDocDate] = useState(today());
  const [expectedDate, setExpectedDate] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [requestId, setRequestId] = useState("");
  const [subtype, setSubtype] = useState(config.subtype?.options[0] ?? "");
  const [partyName, setPartyName] = useState("");
  const [reference, setReference] = useState("");
  const [remarks, setRemarks] = useState("");
  const [meta, setMeta] = useState<Record<string, string>>({});
  const [lines, setLines] = useState<Line[]>(config.linesOptional ? [] : [emptyLine()]);
  const [saving, setSaving] = useState(false);

  const stock = useResource(warehouseId ? `inventory-stock-${warehouseId}` : null, () => inventoryApi.stock(warehouseId));
  const onHand = useMemo(() => new Map((stock.data ?? []).map((s) => [s.itemId, s.qty])), [stock.data]);

  const warehouses = masters.data?.warehouses ?? [];
  const source = warehouses.find((w) => w.id === warehouseId);
  // Items of the source warehouse's business unit (any unit until one is chosen).
  const items = (masters.data?.items ?? []).filter((i) => !source || i.businessUnitId === source.businessUnitId);
  const warehouseOptions = (placeholder: string) => [
    { value: "", label: placeholder },
    ...warehouses.map((w) => ({ value: w.id, label: `${w.name} · ${w.officeName}` })),
  ];

  const pickRequest = (id: string) => {
    setRequestId(id);
    const request = requests.data?.find((r) => r.id === id);
    if (!request) return;
    // Fill warehouses and the open quantity of each requested item.
    setWarehouseId(request.warehouse?.id ?? "");
    setToWarehouseId(request.toWarehouse?.id ?? "");
    if (config.slug === "store-issue" && request.partyName) setPartyName(request.partyName);
    setLines(
      request.lines
        .filter((l) => l.qty - l.processedQty > 0)
        .map((l) => ({ itemId: l.itemId, qty: String(l.qty - l.processedQty), toItemId: "", toQty: "" })),
    );
  };

  // Pick the request the form was opened for, once the requests have loaded.
  const [prefilled, setPrefilled] = useState(false);
  if (initialRequestId && !prefilled && requests.data) {
    setPrefilled(true);
    pickRequest(initialRequestId);
  }

  const setLine = (index: number, patch: Partial<Line>) => setLines((all) => all.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const submit = async () => {
    const input: DocumentInput = {
      docDate,
      expectedDate: expectedDate || undefined,
      warehouseId: warehouseId || undefined,
      toWarehouseId: toWarehouseId || undefined,
      requestId: requestId || undefined,
      subtype: subtype || undefined,
      partyName: partyName || undefined,
      reference: reference || undefined,
      remarks: remarks || undefined,
      meta: config.meta ? meta : undefined,
      lines: lines
        .filter((l) => l.itemId)
        .map((l) => ({
          itemId: l.itemId,
          qty: Number(l.qty),
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

  return (
    <Dialog
      open
      size="xl"
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {config.fulfils && (
              <SelectField
                label={config.fulfils.label}
                value={requestId}
                onChange={(e) => pickRequest(e.target.value)}
                hint="Optional. Fills the warehouses and open quantities."
                options={[
                  { value: "", label: requests.loading ? "Loading…" : "None (direct)" },
                  ...(requests.data ?? []).map((r) => ({ value: r.id, label: `${r.number}${r.partyName ? ` · ${r.partyName}` : ""}` })),
                ]}
              />
            )}
            <TextField label="Date" type="date" required value={docDate} onChange={(e) => setDocDate(e.target.value)} />
            {config.expectedDateLabel && (
              <TextField label={config.expectedDateLabel} type="date" value={expectedDate} min={docDate} onChange={(e) => setExpectedDate(e.target.value)} />
            )}
            {config.warehouses !== "none" && (
              <SelectField
                label={config.warehouseLabel ?? "Warehouse"}
                required
                value={warehouseId}
                disabled={!!requestId}
                onChange={(e) => setWarehouseId(e.target.value)}
                options={warehouseOptions(masters.loading ? "Loading…" : "Select warehouse")}
              />
            )}
            {config.warehouses === "two" && (
              <SelectField
                label={config.toWarehouseLabel ?? "To warehouse"}
                required
                value={toWarehouseId}
                disabled={!!requestId}
                onChange={(e) => setToWarehouseId(e.target.value)}
                options={warehouseOptions("Select warehouse").filter((o) => o.value !== warehouseId)}
              />
            )}
            {config.subtype && (
              <SelectField
                label={config.subtype.label}
                value={subtype}
                onChange={(e) => setSubtype(e.target.value)}
                options={config.subtype.options.map((o) => ({ value: o, label: o }))}
              />
            )}
            {config.partyLabel && <TextField label={config.partyLabel} required value={partyName} maxLength={150} onChange={(e) => setPartyName(e.target.value)} />}
            {config.referenceLabel && <TextField label={config.referenceLabel} value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} />}
            {config.meta?.filter((m) => !m.when || m.when.includes(subtype)).map((m) => (
              <TextField key={m.key} label={m.label} value={meta[m.key] ?? ""} maxLength={200} onChange={(e) => setMeta({ ...meta, [m.key]: e.target.value })} />
            ))}
          </div>

          <div className="overflow-x-auto rounded border border-line">
            <table className="w-full text-sm">
              <thead className="bg-canvas text-xs text-ink-muted">
                <tr>
                  <th className="px-2 py-2 text-left font-semibold">{config.conversion ? "Source item" : "Item"}</th>
                  <th className="w-24 px-2 py-2 text-right font-semibold">In stock</th>
                  <th className="w-32 px-2 py-2 text-right font-semibold">{config.signed ? "Qty (+ add / − remove)" : "Qty"}</th>
                  {config.conversion && <th className="px-2 py-2 text-left font-semibold">Target item</th>}
                  {config.conversion && <th className="w-28 px-2 py-2 text-right font-semibold">Target qty</th>}
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-3 text-center text-xs text-ink-faint">
                      No items. {config.linesOptional ? "Add items if goods pass the gate." : ""}
                    </td>
                  </tr>
                )}
                {lines.map((line, index) => {
                  const item = items.find((i) => i.id === line.itemId);
                  return (
                    <tr key={index} className="border-t border-line">
                      <td className="px-2 py-1.5">
                        <select
                          aria-label="Item"
                          value={line.itemId}
                          onChange={(e) => setLine(index, { itemId: e.target.value })}
                          className={cn(CONTROL, "h-8")}
                        >
                          <option value="">Select item</option>
                          {items.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.code} · {i.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-ink-muted">
                        {line.itemId && warehouseId ? `${onHand.get(line.itemId) ?? 0} ${item?.uom ?? ""}` : "—"}
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          aria-label="Quantity"
                          type="number"
                          step="any"
                          min={config.signed ? undefined : 0}
                          value={line.qty}
                          onChange={(e) => setLine(index, { qty: e.target.value })}
                          className={cn(CONTROL, "h-8 text-right")}
                        />
                      </td>
                      {config.conversion && (
                        <td className="px-2 py-1.5">
                          <select
                            aria-label="Target item"
                            value={line.toItemId}
                            onChange={(e) => setLine(index, { toItemId: e.target.value })}
                            className={cn(CONTROL, "h-8")}
                          >
                            <option value="">Select item</option>
                            {items
                              .filter((i) => i.id !== line.itemId)
                              .map((i) => (
                                <option key={i.id} value={i.id}>
                                  {i.code} · {i.name}
                                </option>
                              ))}
                          </select>
                        </td>
                      )}
                      {config.conversion && (
                        <td className="px-2 py-1.5">
                          <input
                            aria-label="Target quantity"
                            type="number"
                            step="any"
                            min={0}
                            value={line.toQty}
                            onChange={(e) => setLine(index, { toQty: e.target.value })}
                            className={cn(CONTROL, "h-8 text-right")}
                          />
                        </td>
                      )}
                      <td className="px-1 py-1.5 text-center">
                        <Button variant="ghost" size="icon" aria-label="Remove line" onClick={() => setLines(lines.filter((_, i) => i !== index))}>
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div>
            <Button size="sm" onClick={() => setLines([...lines, emptyLine()])}>
              <Plus /> Add item
            </Button>
          </div>
          <TextAreaField label="Remarks" value={remarks} maxLength={500} onChange={(e) => setRemarks(e.target.value)} />
        </div>
      )}
    </Dialog>
  );
}
