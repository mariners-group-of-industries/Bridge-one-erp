"use client";

import { Check, FolderTree, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { EmptyBlock, Input, Select } from "../../employee/components/kit";
import { CATEGORY_LEVELS, type CategoryOption } from "../schemas/item.schema";
import { itemApi } from "../services/item.api";

type Draft = { name: string; description: string };

/** Category tab: the category tree with editable name/description, add child and delete. */
export function CategoryTab({ search }: { search: string }) {
  const toast = useToast();
  const options = useResource("item-form-options", itemApi.formOptions);
  const [unitId, setUnitId] = useState("");
  // Row being edited (id) or a new row being added under a parent ("new:<parentId|root>").
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<CategoryOption | null>(null);

  if (options.error) return <ErrorState message={options.error.message} onRetry={options.reload} />;
  if (!options.data) return <LoadingState label="Loading categories…" />;

  const units = options.data.businessUnits;
  const activeUnit = unitId || units[0]?.id || "";
  const all = options.data.categories.filter((category) => category.businessUnitId === activeUnit);
  const needle = search.toLowerCase();

  // Depth-first order so children sit under their parent.
  const ordered: CategoryOption[] = [];
  const walk = (parentId: string | null) => {
    for (const category of all.filter((c) => (c.parentId ?? null) === parentId)) {
      ordered.push(category);
      walk(category.id);
    }
  };
  walk(null);
  const visible = needle
    ? ordered.filter((c) => c.name.toLowerCase().includes(needle) || (c.description ?? "").toLowerCase().includes(needle))
    : ordered;

  const start = (key: string, values: Draft) => {
    setEditing(key);
    setDraft(values);
  };
  const cancel = () => setEditing(null);

  const save = async () => {
    if (!editing || !draft.name.trim()) {
      toast.error("Enter a name.");
      return;
    }
    setSaving(true);
    try {
      if (editing.startsWith("new:")) {
        const parent = editing.slice(4);
        await itemApi.addCategory({ businessUnitId: activeUnit, parentId: parent === "root" ? "" : parent, ...draft });
        toast.success(`"${draft.name.trim()}" added.`);
      } else {
        await itemApi.updateCategory(editing, draft);
        toast.success(`"${draft.name.trim()}" saved.`);
      }
      setEditing(null);
      options.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await itemApi.deleteCategory(deleting.id);
      toast.success(`"${deleting.name}" deleted.`);
      setDeleting(null);
      options.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const editorRow = (key: string, depth: number, level: number) => (
    <tr key={key} className="[&>td]:bg-accent-soft">
      <td className="px-2.5 py-2 text-ink-faint">—</td>
      <td className="px-2.5 py-2 text-xs whitespace-nowrap">{CATEGORY_LEVELS[level]}</td>
      <td className="px-2.5 py-1.5" style={{ paddingLeft: `${0.625 + depth * 1.25}rem` }}>
        <Input
          autoFocus
          aria-label="Name"
          value={draft.name}
          maxLength={100}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
            if (e.key === "Escape") cancel();
          }}
        />
      </td>
      <td className="px-2.5 py-1.5">
        <Input
          aria-label="Description"
          value={draft.description}
          maxLength={300}
          placeholder="Description"
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
            if (e.key === "Escape") cancel();
          }}
        />
      </td>
      <td className="px-2.5 py-2" />
      <td className="px-1.5 py-1 text-center whitespace-nowrap">
        <Button variant="accent" size="icon" loading={saving} aria-label="Save" onClick={save}>
          {!saving && <Check />}
        </Button>
        <Button variant="ghost" size="icon" aria-label="Cancel" onClick={cancel} disabled={saving}>
          <X />
        </Button>
      </td>
    </tr>
  );

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {units.length > 1 && (
          <Select
            aria-label="Business unit"
            className="w-56"
            value={activeUnit}
            placeholder={false}
            options={units.map((unit) => ({ value: unit.id, label: unit.name }))}
            onChange={(e) => {
              setUnitId(e.target.value);
              setEditing(null);
            }}
          />
        )}
        <p className="text-xs text-ink-faint">Category → Sub Category → Minor Category. Click a name or description to edit it.</p>
        <Button variant="accent-soft" className="ml-auto" disabled={!activeUnit} onClick={() => start("new:root", { name: "", description: "" })}>
          <Plus /> Add Category
        </Button>
      </div>

      {visible.length === 0 && editing !== "new:root" ? (
        <EmptyBlock icon={<FolderTree />} title={needle ? "No matching categories" : "No categories yet"}>
          {needle ? "Try a different search." : "Add the first category."}
        </EmptyBlock>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-grid w-full min-w-max">
            <thead>
              <tr>
                <th scope="col" className="w-12 px-2.5 py-2 text-left">SL</th>
                <th scope="col" className="w-32 px-2.5 py-2 text-left">Level</th>
                <th scope="col" className="px-2.5 py-2 text-left">Name</th>
                <th scope="col" className="px-2.5 py-2 text-left">Description</th>
                <th scope="col" className="w-20 px-2.5 py-2 text-right">Items</th>
                <th scope="col" className="w-36 px-2.5 py-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {editing === "new:root" && editorRow("new:root", 0, 1)}
              {visible.map((category, index) => {
                const depth = category.level - 1;
                const rows = [
                  editing === category.id ? (
                    editorRow(category.id, depth, category.level)
                  ) : (
                    <tr key={category.id}>
                      <td className="px-2.5 py-2 text-right text-ink-faint tabular-nums">{index + 1}</td>
                      <td className="px-2.5 py-2 text-xs whitespace-nowrap text-ink-muted">{CATEGORY_LEVELS[category.level]}</td>
                      <td className="px-2.5 py-2" style={{ paddingLeft: `${0.625 + depth * 1.25}rem` }}>
                        <button
                          type="button"
                          className={cn("text-left hover:underline", category.level === 1 ? "font-semibold text-ink" : "text-ink")}
                          onClick={() => start(category.id, { name: category.name, description: category.description ?? "" })}
                        >
                          {depth > 0 && <span aria-hidden="true" className="mr-1 text-ink-faint">└</span>}
                          {category.name}
                        </button>
                      </td>
                      <td className="max-w-96 px-2.5 py-2">
                        <button
                          type="button"
                          className="w-full truncate text-left text-ink-muted hover:underline"
                          onClick={() => start(category.id, { name: category.name, description: category.description ?? "" })}
                        >
                          {category.description || <span className="text-ink-faint">Add description</span>}
                        </button>
                      </td>
                      <td className="px-2.5 py-2 text-right tabular-nums">{category.itemCount}</td>
                      <td className="px-1.5 py-1 text-center whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:text-accent-strong"
                          aria-label={`Edit ${category.name}`}
                          title="Edit"
                          onClick={() => start(category.id, { name: category.name, description: category.description ?? "" })}
                        >
                          <Pencil />
                        </Button>
                        {category.level < 3 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="hover:text-accent-strong"
                            aria-label={`Add ${CATEGORY_LEVELS[category.level + 1].toLowerCase()} under ${category.name}`}
                            title={`Add ${CATEGORY_LEVELS[category.level + 1]}`}
                            onClick={() => start(`new:${category.id}`, { name: "", description: "" })}
                          >
                            <Plus />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:text-danger"
                          aria-label={`Delete ${category.name}`}
                          title="Delete"
                          onClick={() => setDeleting(category)}
                        >
                          <Trash2 />
                        </Button>
                      </td>
                    </tr>
                  ),
                ];
                if (editing === `new:${category.id}`) rows.push(editorRow(editing, depth + 1, category.level + 1));
                return rows;
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete category?"
        message={deleting ? `Delete "${deleting.name}"? Categories that have sub categories or items cannot be deleted.` : ""}
        busy={saving}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
