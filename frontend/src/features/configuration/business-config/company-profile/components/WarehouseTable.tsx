"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { CONTROL } from "@/components/ui/form-field";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { useValidatedForm } from "@/hooks/use-validated-form";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { warehouseInputSchema } from "../schemas/office.schema";
import { warehouseApi } from "../services/company-profile.api";
import type { WarehouseDto } from "../types";

interface WarehouseTableProps {
  officeId: string;
  onCountChange: (count: number) => void;
}

/** ERPNext child-table grid of an office's warehouses, edited inline. */
export function WarehouseTable({ officeId, onCountChange }: WarehouseTableProps) {
  const toast = useToast();
  const warehouses = useResource(`warehouses:${officeId}`, () => warehouseApi.list(officeId));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<WarehouseDto | null>(null);
  const [busy, setBusy] = useState(false);

  function replaceList(next: WarehouseDto[]) {
    warehouses.mutate(() => next);
    onCountChange(next.length);
  }

  async function confirmDelete() {
    if (!deleting || busy) return;
    setBusy(true);
    try {
      await warehouseApi.remove(deleting.id);
      replaceList((warehouses.data ?? []).filter((item) => item.id !== deleting.id));
      toast.success(`Warehouse "${deleting.name}" deleted.`);
      setDeleting(null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (warehouses.error) return <ErrorState message={warehouses.error.message} onRetry={warehouses.reload} />;
  if (!warehouses.data) return <LoadingState />;

  const list = warehouses.data;

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded border border-line">
        <table className="data-grid w-full">
          <thead className="bg-accent-soft text-xs font-medium text-accent-strong dark:text-accent">
            <tr className="border-b border-accent-line">
              <th scope="col" className="w-14 px-3 py-2 text-left font-medium">
                No.
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Warehouse Name
              </th>
              <th scope="col" className="w-36 px-3 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && !adding && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-sm text-ink-faint">
                  No warehouses yet.
                </td>
              </tr>
            )}
            {list.map((warehouse, index) =>
              editingId === warehouse.id ? (
                <WarehouseRow
                  key={warehouse.id}
                  index={index}
                  officeId={officeId}
                  warehouse={warehouse}
                  onCancel={() => setEditingId(null)}
                  onSaved={(saved) => {
                    setEditingId(null);
                    replaceList(list.map((item) => (item.id === saved.id ? saved : item)));
                  }}
                />
              ) : (
                <tr key={warehouse.id} className="border-b border-line last:border-b-0">
                  <td className="px-3 py-2 text-ink-faint tabular-nums">{index + 1}</td>
                  <td className="px-3 py-2 text-ink">{warehouse.name}</td>
                  <td className="px-2 py-1">
                    <div className="flex justify-end gap-0.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Rename ${warehouse.name}`}
                        onClick={() => setEditingId(warehouse.id)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="hover:text-danger"
                        aria-label={`Delete ${warehouse.name}`}
                        onClick={() => setDeleting(warehouse)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </td>
                </tr>
              ),
            )}
            {adding && (
              <WarehouseRow
                index={list.length}
                officeId={officeId}
                onCancel={() => setAdding(false)}
                onSaved={(saved) => {
                  setAdding(false);
                  replaceList([...list, saved]);
                }}
              />
            )}
          </tbody>
        </table>
      </div>
      {!adding && (
        <div>
          <Button size="sm" variant="accent-soft" onClick={() => setAdding(true)}>
            <Plus /> Add Row
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete warehouse?"
        message={
          deleting && (
            <p>
              <strong>{deleting.name}</strong> will be permanently deleted.
            </p>
          )
        }
        busy={busy}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

interface WarehouseRowProps {
  index: number;
  officeId: string;
  warehouse?: WarehouseDto;
  onSaved: (warehouse: WarehouseDto) => void;
  onCancel: () => void;
}

/** Editable grid row for a new or renamed warehouse. Enter saves, Escape cancels. */
function WarehouseRow({ index, officeId, warehouse, onSaved, onCancel }: WarehouseRowProps) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const form = useValidatedForm(warehouseInputSchema, { name: warehouse?.name ?? "" });

  async function save() {
    if (saving) return;
    const input = form.validate();
    if (!input) return;
    setSaving(true);
    try {
      const saved = warehouse
        ? await warehouseApi.update(warehouse.id, input)
        : await warehouseApi.create(officeId, input);
      toast.success(warehouse ? "Warehouse renamed." : "Warehouse added.");
      onSaved(saved);
    } catch (error) {
      if (!form.applyServerError(error)) toast.error(errorMessage(error));
      setSaving(false);
    }
  }

  return (
    <tr className="border-b border-line bg-accent-soft/40 last:border-b-0">
      <td className="px-3 py-2 align-top text-ink-faint tabular-nums">{index + 1}</td>
      <td className="px-3 py-1.5">
        <input
          autoFocus
          aria-label={warehouse ? `New name for ${warehouse.name}` : "New warehouse name"}
          aria-invalid={!!form.errors.name || undefined}
          maxLength={150}
          placeholder="e.g. Head Office WH"
          value={form.values.name}
          onChange={(event) => form.setField("name", event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void save();
            } else if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
            }
          }}
          className={cn(CONTROL, "h-7 bg-surface", form.errors.name && "ring-1 ring-danger")}
        />
        {form.errors.name && <p className="mt-1 text-xs text-danger">{form.errors.name}</p>}
      </td>
      <td className="px-2 py-1.5 align-top">
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="accent" loading={saving} onClick={save}>
            Save
          </Button>
          <Button size="sm" variant="ghost" disabled={saving} onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </td>
    </tr>
  );
}
