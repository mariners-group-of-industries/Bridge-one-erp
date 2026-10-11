"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import { DATE_FORMAT_LABELS } from "../schemas/business-unit.schema";
import { businessUnitApi } from "../services/company-profile.api";
import type { BusinessUnitDto } from "../types";
import { BusinessUnitForm } from "./BusinessUnitForm";

interface BusinessUnitListProps {
  units: BusinessUnitDto[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChanged: () => void;
  /** Controlled "add" dialog state, so the section header can open it. */
  adding: boolean;
  onAddingChange: (adding: boolean) => void;
}

export function BusinessUnitList({
  units,
  selectedId,
  onSelect,
  onChanged,
  adding,
  onAddingChange,
}: BusinessUnitListProps) {
  const toast = useToast();
  const [editing, setEditing] = useState<BusinessUnitDto | null>(null);
  const [deleting, setDeleting] = useState<BusinessUnitDto | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (!deleting || busy) return;
    setBusy(true);
    try {
      await businessUnitApi.remove(deleting.id);
      toast.success(`Business unit "${deleting.name}" deleted.`);
      setDeleting(null);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {units.length === 0 ? (
        <EmptyState title="No business units yet">
          Add your first business unit to configure offices, warehouses and terms.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">Name</th>
                <th scope="col" className="py-2 pr-4 font-medium">Contact</th>
                <th scope="col" className="py-2 pr-4 font-medium">Date format</th>
                <th scope="col" className="py-2 pr-4 font-medium">Offices</th>
                <th scope="col" className="py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {units.map((unit) => {
                const selected = unit.id === selectedId;
                return (
                  <tr key={unit.id} className={selected ? "bg-blue-50/60" : undefined}>
                    <td className="py-3 pr-4 align-top">
                      <p className="font-medium text-zinc-900">{unit.name}</p>
                      <p className="max-w-xs whitespace-pre-line text-xs text-zinc-500">{unit.address}</p>
                    </td>
                    <td className="py-3 pr-4 align-top text-zinc-700">
                      <p>{unit.email}</p>
                      <p className="text-xs text-zinc-500">{unit.contactNumber}</p>
                    </td>
                    <td className="py-3 pr-4 align-top text-zinc-700">
                      {DATE_FORMAT_LABELS[unit.dateFormat]}
                    </td>
                    <td className="py-3 pr-4 align-top text-zinc-700">{unit.officeCount}</td>
                    <td className="py-3 align-top">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant={selected ? "primary" : "secondary"}
                          aria-pressed={selected}
                          onClick={() => onSelect(unit.id)}
                        >
                          {selected ? "Selected" : "Manage"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(unit)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-700"
                          onClick={() => setDeleting(unit)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(adding || editing) && (
        <BusinessUnitForm
          businessUnit={editing ?? undefined}
          onClose={() => {
            setEditing(null);
            onAddingChange(false);
          }}
          onSaved={(unit) => {
            setEditing(null);
            onAddingChange(false);
            onChanged();
            onSelect(unit.id);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete business unit?"
        busy={busy}
        message={
          deleting && (
            <>
              <p>
                <strong>{deleting.name}</strong> and its sales and purchase terms will be permanently
                deleted.
              </p>
              {deleting.officeCount > 0 && (
                <p className="mt-2 text-red-700">
                  This unit still has {deleting.officeCount} office(s). Remove them first.
                </p>
              )}
            </>
          )
        }
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
