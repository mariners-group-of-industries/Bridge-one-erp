"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/form-field";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import { useResource } from "../hooks/use-resource";
import { useValidatedForm } from "../hooks/use-validated-form";
import { warehouseInputSchema } from "../schemas/office.schema";
import { warehouseApi } from "../services/company-profile.api";
import type { WarehouseDto } from "../types";

interface WarehouseListProps {
  officeId: string;
  officeName: string;
  onCountChange: (count: number) => void;
}

export function WarehouseList({ officeId, officeName, onCountChange }: WarehouseListProps) {
  const toast = useToast();
  const warehouses = useResource(`warehouses:${officeId}`, () => warehouseApi.list(officeId));
  const [editingId, setEditingId] = useState<string | null>(null);
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

  if (warehouses.error) {
    return <ErrorState message={warehouses.error.message} onRetry={warehouses.reload} />;
  }
  if (!warehouses.data) return <LoadingState label="Loading warehouses…" />;

  const list = warehouses.data;

  return (
    <div className="flex flex-col gap-3">
      {list.length === 0 ? (
        <p className="text-sm text-zinc-500">No warehouses in {officeName} yet.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
          {list.map((warehouse) =>
            editingId === warehouse.id ? (
              <li key={warehouse.id} className="p-3">
                <WarehouseNameForm
                  officeId={officeId}
                  warehouse={warehouse}
                  onCancel={() => setEditingId(null)}
                  onSaved={(saved) => {
                    setEditingId(null);
                    replaceList(list.map((item) => (item.id === saved.id ? saved : item)));
                  }}
                />
              </li>
            ) : (
              <li key={warehouse.id} className="flex items-center gap-3 px-3 py-2">
                <span aria-hidden="true" className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                  WH
                </span>
                <span className="flex-1 text-sm text-zinc-800">{warehouse.name}</span>
                <Button size="sm" variant="ghost" onClick={() => setEditingId(warehouse.id)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" className="text-red-700" onClick={() => setDeleting(warehouse)}>
                  Delete
                </Button>
              </li>
            ),
          )}
        </ul>
      )}

      <WarehouseNameForm
        officeId={officeId}
        onSaved={(saved) => replaceList([...list, saved])}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Delete warehouse?"
        message={deleting && <p><strong>{deleting.name}</strong> will be permanently deleted.</p>}
        busy={busy}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

interface WarehouseNameFormProps {
  officeId: string;
  warehouse?: WarehouseDto;
  onSaved: (warehouse: WarehouseDto) => void;
  onCancel?: () => void;
}

function WarehouseNameForm({ officeId, warehouse, onSaved, onCancel }: WarehouseNameFormProps) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const form = useValidatedForm(warehouseInputSchema, { name: warehouse?.name ?? "" });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const input = form.validate();
    if (!input) return;
    setSaving(true);
    try {
      const saved = warehouse
        ? await warehouseApi.update(warehouse.id, input)
        : await warehouseApi.create(officeId, input);
      toast.success(warehouse ? "Warehouse renamed." : "Warehouse added.");
      if (!warehouse) form.reset({ name: "" });
      onSaved(saved);
    } catch (error) {
      if (!form.applyServerError(error)) toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <TextField
        label={warehouse ? "Warehouse name" : "New warehouse"}
        maxLength={150}
        placeholder="e.g. Head Office WH"
        className="flex-1"
        autoFocus={!!warehouse}
        value={form.values.name}
        error={form.errors.name}
        onChange={(event) => form.setField("name", event.target.value)}
      />
      <div className="flex gap-2 sm:pt-7">
        <Button type="submit" size="md" variant={warehouse ? "primary" : "secondary"} loading={saving}>
          {warehouse ? "Save" : "Add warehouse"}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
