"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { CONTROL, TextField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { InventoryDocument } from "../schemas/document.schema";
import { inventoryApi, today } from "../services/inventory.api";

/**
 * Receives a transfer in transit. What arrives goes into the receiving
 * warehouse; any shortfall goes back to the sending warehouse (a return).
 */
export function ReceiveTransferDialog({
  transfer,
  onClose,
  onReceived,
}: {
  transfer: InventoryDocument | null;
  onClose: () => void;
  onReceived: () => void;
}) {
  return transfer ? <ReceiveForm key={transfer.id} transfer={transfer} onClose={onClose} onReceived={onReceived} /> : null;
}

function ReceiveForm({ transfer, onClose, onReceived }: { transfer: InventoryDocument; onClose: () => void; onReceived: () => void }) {
  const toast = useToast();
  const [receiveDate, setReceiveDate] = useState(today());
  const [received, setReceived] = useState<Record<string, string>>(Object.fromEntries(transfer.lines.map((l) => [l.id, String(l.qty)])));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await inventoryApi.receive(
        transfer.id,
        transfer.lines.map((l) => ({ lineId: l.id, receivedQty: Math.min(l.qty, Math.max(0, Number(received[l.id]) || 0)) })),
        receiveDate,
      );
      toast.success(`${transfer.number} received.`);
      onReceived();
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
      size="lg"
      title={`Receive ${transfer.number}`}
      description={`${transfer.warehouse?.name ?? ""} → ${transfer.toWarehouse?.name ?? ""}. Anything not received goes back to ${transfer.warehouse?.name ?? "the sending warehouse"}.`}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            Receive
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <TextField label="Receive date" type="date" required value={receiveDate} min={transfer.docDate} onChange={(e) => setReceiveDate(e.target.value)} className="sm:max-w-48" />
        <table className="w-full text-sm">
          <thead className="bg-canvas text-xs text-ink-muted">
            <tr>
              <th className="px-2 py-2 text-left font-semibold">Item</th>
              <th className="w-24 px-2 py-2 text-right font-semibold">Sent</th>
              <th className="w-32 px-2 py-2 text-right font-semibold">Received</th>
            </tr>
          </thead>
          <tbody>
            {transfer.lines.map((l) => (
              <tr key={l.id} className="border-t border-line">
                <td className="px-2 py-1.5">
                  {l.itemCode} · {l.itemName}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {l.qty} {l.uom}
                </td>
                <td className="px-2 py-1.5">
                  <input
                    aria-label={`Received ${l.itemName}`}
                    type="number"
                    step="any"
                    min={0}
                    max={l.qty}
                    value={received[l.id] ?? ""}
                    onChange={(e) => setReceived({ ...received, [l.id]: e.target.value })}
                    className={cn(CONTROL, "h-8 text-right")}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Dialog>
  );
}
