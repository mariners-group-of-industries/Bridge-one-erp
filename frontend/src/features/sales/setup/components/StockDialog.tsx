"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectField, TextField } from "@/components/ui/form-field";
import { Indicator } from "@/components/ui/indicator";
import { EmptyState, ErrorState, FieldGrid, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatQty } from "../../dashboard/lib/format";
import { stockAdjustmentSchema } from "../../deliveries/schemas/delivery.schema";
import { adjustStock, fetchItemStock } from "../../deliveries/services/delivery.api";
import { issuesToErrors, requiredNumber } from "../../lib/form";
import type { ItemOption } from "../../masters/schemas/masters.schema";

const SOURCE_LABELS = { OPENING: "Opening", ADJUSTMENT: "Adjustment", SALES_DELIVERY: "Delivery", SALES_RETURN: "Return" } as const;

/** Stock per warehouse for one item, its movements, and opening stock / adjustments. */
export function StockDialog({ item, today, onClose }: { item: ItemOption; today: string; onClose: () => void }) {
  const toast = useToast();
  const stock = useResource(`item-stock:${item.id}`, () => fetchItemStock(item.id));
  const [values, setValues] = useState({ warehouseId: "", source: "OPENING" as "OPENING" | "ADJUSTMENT", qty: "", postingDate: today, remarks: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const warehouseId = values.warehouseId || stock.data?.warehouses[0]?.warehouseId || "";

  async function save() {
    const input = { ...values, warehouseId, itemId: item.id, qty: requiredNumber(values.qty) };
    const parsed = stockAdjustmentSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await adjustStock(input);
      toast.success(`Stock of ${item.name} updated.`);
      setValues({ ...values, qty: "", remarks: "" });
      stock.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      size="lg"
      title={`Stock: ${item.name}`}
      description={`${item.code} · ${item.uom}${item.altUom ? ` (${item.altUomFactor} per ${item.altUom})` : ""}`}
      onClose={busy ? () => undefined : onClose}
      onSubmit={save}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Close
          </Button>
          <Button type="submit" variant="primary" loading={busy} disabled={!warehouseId}>
            Save Entry
          </Button>
        </>
      }
    >
      {stock.error ? (
        <ErrorState message={errorMessage(stock.error)} onRetry={stock.reload} />
      ) : !stock.data ? (
        <LoadingState />
      ) : (
        <div className="flex flex-col gap-5">
          {stock.data.warehouses.length === 0 ? (
            <EmptyState title="No warehouses">Add a warehouse to an office in Configuration first.</EmptyState>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {stock.data.warehouses.map((row) => (
                <li key={row.warehouseId} className="flex items-center justify-between rounded-lg bg-canvas px-3 py-2 text-sm">
                  <span>
                    <span className="text-ink">{row.warehouseName}</span> <span className="text-xs text-ink-faint">· {row.officeName}</span>
                  </span>
                  <span className={cn("font-semibold tabular-nums", row.qty > 0 ? "text-ink" : "text-danger")}>{formatQty(row.qty)}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-ink">Add Opening Stock or Adjustment</h3>
            <FieldGrid>
              <SelectField
                label="Warehouse"
                required
                value={warehouseId}
                error={errors.warehouseId}
                options={stock.data.warehouses.map((row) => ({ value: row.warehouseId, label: `${row.warehouseName} (${row.officeName})` }))}
                onChange={(event) => setValues({ ...values, warehouseId: event.target.value })}
              />
              <SelectField
                label="Type"
                value={values.source}
                options={[
                  { value: "OPENING", label: "Opening stock" },
                  { value: "ADJUSTMENT", label: "Adjustment (+ in / − out)" },
                ]}
                onChange={(event) => setValues({ ...values, source: event.target.value as "OPENING" | "ADJUSTMENT" })}
              />
              <TextField
                label={`Quantity (${item.uom})`}
                type="number"
                step="any"
                required
                hint="Negative to take stock out (damage, count difference)."
                value={values.qty}
                error={errors.qty}
                onChange={(event) => setValues({ ...values, qty: event.target.value })}
              />
              <TextField label="Date" type="date" required value={values.postingDate} error={errors.postingDate} onChange={(event) => setValues({ ...values, postingDate: event.target.value })} />
              <TextField label="Remarks" className="md:col-span-2" value={values.remarks} error={errors.remarks} onChange={(event) => setValues({ ...values, remarks: event.target.value })} />
            </FieldGrid>
          </div>

          {stock.data.entries.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-ink">Recent Movements</h3>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-line">
                  {stock.data.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="py-1.5 text-ink-muted">{entry.postingDate}</td>
                      <td className="py-1.5">
                        <Indicator>{SOURCE_LABELS[entry.source]}</Indicator>
                      </td>
                      <td className="py-1.5 text-ink-muted">{entry.warehouseName}</td>
                      <td className="py-1.5 text-ink-faint">{entry.remarks}</td>
                      <td className={cn("py-1.5 text-right font-medium tabular-nums", entry.qty < 0 ? "text-danger" : "text-success")}>
                        {entry.qty > 0 ? "+" : ""}
                        {formatQty(entry.qty)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
