"use client";

import { Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { CheckboxField, SelectField, TextField } from "@/components/ui/form-field";
import { Indicator } from "@/components/ui/indicator";
import { EmptyState, Section } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import {
  AREA_KINDS,
  AREA_KIND_LABELS,
  CATEGORY_LEVEL_LABELS,
  type AreaKind,
  type SetupKind,
  type SetupLookups,
} from "../../masters/schemas/masters.schema";
import { createSetupRecord, deleteSetupRecord, updateSetupRecord } from "../../masters/services/masters.api";

interface Row {
  id: string;
  name: string;
  /** Indent level for trees (categories). */
  depth?: number;
  badge?: string;
  isDefault?: boolean;
  /** Parent for "Add sub-category". */
  canAddChild?: boolean;
}

type Editing =
  | { mode: "create"; parentId?: string | null; kind?: AreaKind }
  | { mode: "rename"; row: Row }
  | null;

interface PanelProps {
  kind: SetupKind;
  businessUnitId: string;
  lookups: SetupLookups;
  onChanged: () => void;
}

const TITLES: Record<SetupKind, { title: string; singular: string; description: string }> = {
  "customer-groups": { title: "Customer Groups", singular: "Customer Group", description: "Regions or channels used to group customers in reports." },
  areas: { title: "Zones, Territories, Routes & Sections", singular: "Area", description: "Where customers are; used for filters and reports." },
  categories: { title: "Item Categories", singular: "Category", description: "Category › Sub Category › Minor Category." },
  "price-lists": { title: "Price Types", singular: "Price Type", description: "Dealer, retail … prices. The default one fills new orders." },
};

/** Rows for a kind, ordered for display (category tree flattened depth-first). */
function rowsFor(kind: SetupKind, lookups: SetupLookups, businessUnitId: string): Row[] {
  switch (kind) {
    case "customer-groups":
      return lookups.customerGroups.filter((row) => row.businessUnitId === businessUnitId);
    case "areas":
      return lookups.areas
        .filter((row) => row.businessUnitId === businessUnitId)
        .map((row) => ({ ...row, badge: AREA_KIND_LABELS[row.kind] }));
    case "price-lists":
      return lookups.priceLists.filter((row) => row.businessUnitId === businessUnitId);
    case "categories": {
      const categories = lookups.categories.filter((row) => row.businessUnitId === businessUnitId);
      const rows: Row[] = [];
      const visit = (parentId: string | null, depth: number) => {
        for (const category of categories.filter((row) => row.parentId === parentId)) {
          rows.push({ id: category.id, name: category.name, depth, badge: CATEGORY_LEVEL_LABELS[category.level], canAddChild: category.level < 3 });
          visit(category.id, depth + 1);
        }
      };
      visit(null, 0);
      return rows;
    }
  }
}

export function SimpleMastersPanel({ kind, businessUnitId, lookups, onChanged }: PanelProps) {
  const toast = useToast();
  const [editing, setEditing] = useState<Editing>(null);
  const [name, setName] = useState("");
  const [areaKind, setAreaKind] = useState<AreaKind>("TERRITORY");
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const [areaFilter, setAreaFilter] = useState<AreaKind | "">("");

  const meta = TITLES[kind];
  const rows = rowsFor(kind, lookups, businessUnitId).filter(
    (row) => kind !== "areas" || !areaFilter || row.badge === AREA_KIND_LABELS[areaFilter],
  );

  function open(next: Editing) {
    setEditing(next);
    setName(next?.mode === "rename" ? next.row.name : "");
    setIsDefault(next?.mode === "rename" ? !!next.row.isDefault : false);
    if (next?.mode === "create" && next.kind) setAreaKind(next.kind);
    setError(undefined);
  }

  async function save() {
    if (!editing) return;
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    try {
      if (editing.mode === "create") {
        await createSetupRecord(kind, {
          businessUnitId,
          name,
          ...(kind === "areas" ? { kind: areaKind } : {}),
          ...(kind === "categories" ? { parentId: editing.parentId ?? null } : {}),
          ...(kind === "price-lists" ? { isDefault } : {}),
        });
        toast.success(`${meta.singular} added.`);
      } else {
        await updateSetupRecord(kind, editing.row.id, { name, ...(kind === "price-lists" ? { isDefault } : {}) });
        toast.success(`${meta.singular} updated.`);
      }
      setEditing(null);
      onChanged();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!toDelete) return;
    setBusy(true);
    try {
      await deleteSetupRecord(kind, toDelete.id);
      toast.success(`${toDelete.name} deleted.`);
      onChanged();
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setBusy(false);
      setToDelete(null);
    }
  }

  const parentName =
    editing?.mode === "create" && editing.parentId ? lookups.categories.find((row) => row.id === editing.parentId)?.name : undefined;

  return (
    <Section
      title={meta.title}
      description={meta.description}
      actions={
        <Button size="sm" variant="primary" onClick={() => open({ mode: "create", parentId: null, kind: areaFilter || "TERRITORY" })}>
          <Plus aria-hidden="true" />
          Add {kind === "categories" ? "Category" : meta.singular}
        </Button>
      }
    >
      {kind === "areas" && (
        <div role="group" aria-label="Area type" className="flex flex-wrap gap-1">
          {(["", ...AREA_KINDS] as const).map((value) => (
            <Button
              key={value || "all"}
              size="sm"
              aria-pressed={areaFilter === value}
              className={cn(areaFilter === value && "bg-hover text-ink")}
              onClick={() => setAreaFilter(value)}
            >
              {value ? AREA_KIND_LABELS[value] : "All"}
            </Button>
          ))}
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState title={`No ${meta.title.toLowerCase()} yet`} />
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-2 px-3 py-1.5">
              <span className="flex min-w-0 flex-1 items-center gap-2" style={{ paddingLeft: `${(row.depth ?? 0) * 20}px` }}>
                <span className="truncate text-sm text-ink">{row.name}</span>
                {row.badge && <Indicator>{row.badge}</Indicator>}
                {row.isDefault && (
                  <Indicator color="blue">
                    <Star className="size-3" aria-hidden="true" />
                    Default
                  </Indicator>
                )}
              </span>
              {row.canAddChild && (
                <Button size="sm" variant="ghost" onClick={() => open({ mode: "create", parentId: row.id })}>
                  <Plus aria-hidden="true" />
                  Sub
                </Button>
              )}
              <Button size="icon" variant="ghost" aria-label={`Rename ${row.name}`} onClick={() => open({ mode: "rename", row })}>
                <Pencil />
              </Button>
              <Button size="icon" variant="ghost" aria-label={`Delete ${row.name}`} onClick={() => setToDelete(row)}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={editing !== null}
        title={
          editing?.mode === "rename"
            ? `Edit ${meta.singular}`
            : parentName
              ? `Add under ${parentName}`
              : `Add ${kind === "categories" ? "Category" : meta.singular}`
        }
        onClose={busy ? () => undefined : () => setEditing(null)}
        onSubmit={save}
        footer={
          <>
            <Button onClick={() => setEditing(null)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={busy}>
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {kind === "areas" && editing?.mode === "create" && (
            <SelectField
              label="Type"
              value={areaKind}
              options={AREA_KINDS.map((value) => ({ value, label: AREA_KIND_LABELS[value] }))}
              onChange={(event) => setAreaKind(event.target.value as AreaKind)}
            />
          )}
          <TextField label="Name" required value={name} error={error} maxLength={100} onChange={(event) => setName(event.target.value)} />
          {kind === "price-lists" && (
            <CheckboxField
              label="Default price type"
              hint="Used for new sales orders."
              checked={isDefault}
              onChange={(event) => setIsDefault(event.target.checked)}
            />
          )}
        </div>
      </Dialog>
      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete ${toDelete?.name ?? ""}?`}
        message="Records in use by customers, items or orders cannot be deleted."
        busy={busy}
        onConfirm={remove}
        onClose={() => setToDelete(null)}
      />
    </Section>
  );
}
