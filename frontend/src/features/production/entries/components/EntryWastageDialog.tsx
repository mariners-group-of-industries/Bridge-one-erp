"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { CONTROL, TextField } from "@/components/ui/form-field";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { Combobox } from "@/features/production/components/Combobox";
import { day, qty2 } from "@/features/production/orders/components/OrderParts";
import { entryWastageSchema, type EntryWastageForm } from "../schemas/entry.schema";
import { createProcess, fetchEntryWastage, saveEntryWastage } from "../services/entry.api";

interface Row {
  key: number;
  processId: string;
  itemId: string;
  qty: string;
}

let nextKey = 1;
const emptyRow = (): Row => ({ key: nextKey++, processId: "", itemId: "", qty: "" });

function Pair({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_auto_1fr] gap-x-2 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <span aria-hidden="true" className="text-ink-faint">
        :
      </span>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}

/** "Process Wise Wastage Entry" of a production entry (the list's + action). */
export function EntryWastageDialog({ id, onClose, onSaved }: { id: string | null; onClose: () => void; onSaved: () => void }) {
  const form = useResource(id ? `entry-wastage:${id}` : null, () => fetchEntryWastage(id!));
  return (
    <Dialog open={id !== null} title="Process Wise Wastage Entry" size="xl" className="max-w-5xl" onClose={onClose}>
      {form.error ? (
        <ErrorState message={errorMessage(form.error)} onRetry={form.reload} />
      ) : !form.data ? (
        <LoadingState />
      ) : (
        // Remount per load so the rows start from the saved lines.
        <WastageEditor key={`${form.data.entry.id}:${form.data.lines.length}`} form={form.data} onClose={onClose} onSaved={onSaved} />
      )}
    </Dialog>
  );
}

function WastageEditor({ form, onClose, onSaved }: { form: EntryWastageForm; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [processes, setProcesses] = useState(form.processes);
  const [rows, setRows] = useState<Row[]>(() =>
    form.lines.length ? form.lines.map((line) => ({ key: nextKey++, processId: line.processId, itemId: line.itemId, qty: String(line.qty) })) : [emptyRow()],
  );
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [newProcess, setNewProcess] = useState<string | null>(null);
  const [addingProcess, setAddingProcess] = useState(false);
  const readOnly = !form.canEdit;
  const itemById = new Map(form.items.map((item) => [item.id, item]));
  const processOptions = processes.map((process) => ({ value: process.id, label: process.name }));
  const itemOptions = form.items.map((item) => ({ value: item.id, label: `${item.code} - ${item.name} (${item.uom})` }));

  const update = (key: number, patch: Partial<Row>) => setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const insertAfter = (key: number) => setRows((current) => current.flatMap((row) => (row.key === key ? [row, emptyRow()] : [row])));
  const remove = (key: number) => setRows((current) => (current.length === 1 ? [emptyRow()] : current.filter((row) => row.key !== key)));

  async function addProcess() {
    if (!newProcess?.trim()) return;
    setAddingProcess(true);
    try {
      const created = await createProcess(newProcess.trim(), form.entry.businessUnitId);
      setProcesses((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success(`Process ${created.name} added.`);
      setNewProcess(null);
    } catch (failure) {
      toast.error(errorMessage(failure));
    } finally {
      setAddingProcess(false);
    }
  }

  async function save() {
    // Rows left completely blank are ignored.
    const filled = rows.filter((row) => row.processId || row.itemId || row.qty.trim());
    const input = { lines: filled.map((row) => ({ processId: row.processId, itemId: row.itemId, qty: row.qty.trim() === "" ? Number.NaN : Number(row.qty) })) };
    const parsed = entryWastageSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const line = typeof issue?.path[1] === "number" ? `Line ${issue.path[1] + 1}: ` : "";
      return setError(`${line}${issue?.message ?? "Please check the lines."}`);
    }
    setError(undefined);
    setBusy(true);
    try {
      const saved = await saveEntryWastage(form.entry.id, input);
      toast.success(`${saved.lines.length} wastage line${saved.lines.length === 1 ? "" : "s"} saved for ${form.entry.number}.`);
      onSaved();
      onClose();
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-x-10 gap-y-1.5 md:grid-cols-2">
        <Pair label="Date" value={day(form.entry.entryDate)} />
        <Pair label="Production Order Code" value={form.entry.orderNumber} />
        <Pair label="Item Name" value={`${form.entry.itemCode} - ${form.entry.itemName} (${form.entry.uom})`} />
        <Pair label="Production Entry Code" value={form.entry.number} />
      </dl>

      {readOnly && (
        <p className="rounded-md bg-control px-3 py-2 text-sm text-ink-muted">
          {form.entry.status === "CANCELLED" ? "This entry is cancelled; its wastage can only be viewed." : "You can view the wastage, but not change it."}
        </p>
      )}

      {!readOnly && (
        <div className="flex flex-wrap items-end justify-end gap-2">
          {newProcess === null ? (
            <button type="button" onClick={() => setNewProcess("")} className="text-xs font-medium text-accent-strong hover:underline">
              ADD NEW PROCESS
            </button>
          ) : (
            <>
              <TextField
                label="New Process Name"
                className="w-64"
                autoFocus
                maxLength={100}
                placeholder="e.g. Mixing, Frying, Packing"
                value={newProcess}
                onChange={(event) => setNewProcess(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void addProcess();
                  }
                }}
              />
              <Button size="sm" variant="primary" onClick={addProcess} loading={addingProcess} disabled={!newProcess.trim()}>
                Add
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setNewProcess(null)}>
                Cancel
              </Button>
            </>
          )}
        </div>
      )}

      {/* No overflow clipping here: the row dropdowns open below the table. */}
      <div className="rounded-md border border-line">
        <table className="w-full text-sm">
          <thead className="bg-accent-soft text-xs text-ink">
            <tr>
              <th scope="col" className="w-12 px-3 py-2 text-left font-semibold">
                SL
              </th>
              <th scope="col" className="px-3 py-2 text-left font-semibold">
                Process Name
              </th>
              <th scope="col" className="px-3 py-2 text-left font-semibold">
                Item Name
              </th>
              <th scope="col" className="w-48 px-3 py-2 text-left font-semibold">
                Wastage Quantity
              </th>
              {!readOnly && (
                <th scope="col" className="w-24 px-3 py-2 text-center font-semibold">
                  Action
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {readOnly ? (
              form.lines.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-ink-faint">
                    No wastage recorded.
                  </td>
                </tr>
              ) : (
                form.lines.map((line, index) => (
                  <tr key={`${line.processId}|${line.itemId}`} className="border-t border-line">
                    <td className="px-3 py-2 text-ink-muted tabular-nums">{index + 1}</td>
                    <td className="px-3 py-2 text-ink">{line.processName}</td>
                    <td className="px-3 py-2 text-ink">{`${line.code} - ${line.name}`}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {qty2(line.qty)} {line.uom}
                    </td>
                  </tr>
                ))
              )
            ) : (
              rows.map((row, index) => {
                const uom = itemById.get(row.itemId)?.uom;
                return (
                  <tr key={row.key} className="border-t border-line align-top">
                    <td className="px-3 py-2 text-ink-muted tabular-nums">{index + 1}</td>
                    <td className="px-2 py-1.5">
                      <Combobox
                        hideLabel
                        label={`Process Name, line ${index + 1}`}
                        placeholder="Process Name"
                        value={row.processId}
                        options={processOptions}
                        emptyText={processes.length ? "No process matches." : "No process yet. Use ADD NEW PROCESS."}
                        onChange={(processId) => update(row.key, { processId })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Combobox
                        hideLabel
                        label={`Item Name, line ${index + 1}`}
                        placeholder="Item Name"
                        value={row.itemId}
                        options={itemOptions}
                        emptyText="No item matches."
                        onChange={(itemId) => update(row.key, { itemId })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="any"
                          aria-label={`Wastage Quantity, line ${index + 1}`}
                          placeholder="Wastage Quantity"
                          value={row.qty}
                          onChange={(event) => update(row.key, { qty: event.target.value })}
                          className={cn(CONTROL, "h-8 text-right tabular-nums")}
                        />
                        {uom && <span className="text-xs text-ink-muted">{uom}</span>}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-center whitespace-nowrap">
                      <Button size="icon" variant="ghost" className="hover:text-accent-strong" aria-label={`Add a line after line ${index + 1}`} title="Add line" onClick={() => insertAfter(row.key)}>
                        <Plus aria-hidden="true" />
                      </Button>
                      <Button size="icon" variant="ghost" className="hover:text-danger" aria-label={`Remove line ${index + 1}`} title="Remove line" onClick={() => remove(row.key)}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <p className="text-xs text-ink-faint">Wastage is recorded for reporting; the entry already consumed its materials, so stock does not change.</p>

      <div className="flex justify-end gap-2 border-t border-line pt-3">
        <Button variant="ghost" className="text-danger" onClick={onClose} disabled={busy}>
          CLOSE
        </Button>
        {!readOnly && (
          <Button variant="primary" onClick={save} loading={busy}>
            <Save aria-hidden="true" />
            SAVE
          </Button>
        )}
      </div>
    </div>
  );
}
