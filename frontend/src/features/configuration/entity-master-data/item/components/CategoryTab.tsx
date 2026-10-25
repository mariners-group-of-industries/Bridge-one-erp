"use client";

import {
  Check,
  ChevronDown,
  ChevronRight,
  FolderTree,
  MinusSquare,
  Pencil,
  Plus,
  PlusCircle,
  PlusSquare,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
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

/**
 * Category tab: Tree view matching legacy ERP layout with expand/collapse nodes,
 * indented sub-categories, green Add (+) action, and inline editing.
 */
export function CategoryTab({ search }: { search: string }) {
  const toast = useToast();
  const options = useResource("item-form-options", itemApi.formOptions);
  const [unitId, setUnitId] = useState("");
  // Set of collapsed parent category IDs (expanded by default)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // Row being edited (id) or a new row being added under a parent ("new:<parentId|root>").
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<CategoryOption | null>(null);

  const units = options.data?.businessUnits ?? [];
  const activeUnit = unitId || units[0]?.id || "";
  const all = useMemo(
    () => (options.data?.categories ?? []).filter((c) => c.businessUnitId === activeUnit),
    [options.data, activeUnit],
  );

  // Map each category to its direct children
  const childrenMap = useMemo(() => {
    const map = new Map<string | null, CategoryOption[]>();
    for (const c of all) {
      const p = c.parentId ?? null;
      if (!map.has(p)) map.set(p, []);
      map.get(p)!.push(c);
    }
    return map;
  }, [all]);

  // All parent IDs that have children
  const parentIds = useMemo(() => {
    const set = new Set<string>();
    for (const c of all) {
      if (c.parentId) set.add(c.parentId);
    }
    return set;
  }, [all]);

  const needle = search.trim().toLowerCase();

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(new Set(parentIds));

  // Build depth-first tree
  const treeNodes = useMemo(() => {
    const list: { category: CategoryOption; depth: number; isHidden: boolean; hasChildren: boolean }[] = [];

    const walk = (parentId: string | null, depth: number, parentCollapsed: boolean) => {
      const children = childrenMap.get(parentId) ?? [];
      for (const cat of children) {
        const isCollapsed = collapsed.has(cat.id);
        const hasChildren = parentIds.has(cat.id);
        list.push({
          category: cat,
          depth,
          isHidden: parentCollapsed,
          hasChildren,
        });
        walk(cat.id, depth + 1, parentCollapsed || isCollapsed);
      }
    };

    walk(null, 0, false);
    return list;
  }, [childrenMap, collapsed, parentIds]);

  if (options.error) return <ErrorState message={options.error.message} onRetry={options.reload} />;
  if (!options.data) return <LoadingState label="Loading categories…" />;

  // Filter based on search (if searching, show matching rows regardless of collapse)
  const visibleRows = needle
    ? treeNodes.filter(
        ({ category }) =>
          category.name.toLowerCase().includes(needle) ||
          (category.description ?? "").toLowerCase().includes(needle),
      )
    : treeNodes.filter((node) => !node.isHidden);

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
        // Ensure parent is expanded so newly created child is visible
        if (parent !== "root") {
          setCollapsed((prev) => {
            const next = new Set(prev);
            next.delete(parent);
            return next;
          });
        }
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
    <tr key={key} className="bg-emerald-50/50 dark:bg-emerald-950/20">
      <td className="px-3 py-2 text-ink-faint text-center w-10">—</td>
      <td className="px-3 py-2" style={{ paddingLeft: `${0.75 + depth * 1.5}rem` }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-surface-raised border border-border text-ink-muted">
            {CATEGORY_LEVELS[level]}
          </span>
          <Input
            autoFocus
            aria-label="Name"
            className="h-8 max-w-sm"
            placeholder="Category name (e.g. Snacks [SNA])"
            value={draft.name}
            maxLength={100}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
              if (e.key === "Escape") cancel();
            }}
          />
          <Input
            aria-label="Description"
            className="h-8 max-w-xs"
            placeholder="Description / Code (optional)"
            value={draft.description}
            maxLength={300}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
              if (e.key === "Escape") cancel();
            }}
          />
        </div>
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap w-28">
        <div className="flex items-center justify-end gap-1">
          <Button variant="accent" size="sm" loading={saving} aria-label="Save" onClick={save}>
            {!saving && <Check className="w-4 h-4 mr-1" />} Save
          </Button>
          <Button variant="ghost" size="icon" aria-label="Cancel" onClick={cancel} disabled={saving}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Top Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-border">
        <div className="flex items-center gap-3">
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
          <span className="text-xs font-medium text-ink-muted bg-surface-raised px-2.5 py-1 rounded-md border border-border">
            {all.length} categories & sub-categories
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="sm"
              className="text-xs h-7 px-2"
              onClick={expandAll}
              title="Expand all categories"
            >
              Expand All
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="text-xs h-7 px-2"
              onClick={collapseAll}
              title="Collapse all categories"
            >
              Collapse All
            </Button>
          </div>
        </div>

        <Button
          variant="accent"
          size="sm"
          className="gap-1.5"
          disabled={!activeUnit}
          onClick={() => start("new:root", { name: "", description: "" })}
        >
          <Plus className="w-4 h-4" /> Add Category
        </Button>
      </div>

      {visibleRows.length === 0 && editing !== "new:root" ? (
        <EmptyBlock icon={<FolderTree />} title={needle ? "No matching categories" : "No categories yet"}>
          {needle ? "Try a different search." : "Add the first category."}
        </EmptyBlock>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-raised text-ink-muted font-medium text-xs">
                <th scope="col" className="w-10 px-3 py-2.5 text-center">#</th>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">Description</th>
                <th scope="col" className="w-28 px-4 py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {editing === "new:root" && editorRow("new:root", 0, 1)}

              {visibleRows.map(({ category, depth, hasChildren }, index) => {
                const isCollapsed = collapsed.has(category.id);
                const isEditingThis = editing === category.id;
                const isEditingChild = editing === `new:${category.id}`;

                if (isEditingThis) {
                  return editorRow(category.id, depth, category.level);
                }

                return (
                  <tr
                    key={category.id}
                    className={cn(
                      "group hover:bg-surface-raised/70 transition-colors",
                      category.level === 1 && "font-medium",
                    )}
                  >
                    {/* Index */}
                    <td className="px-3 py-2 text-center text-xs text-ink-faint tabular-nums w-10 select-none">
                      {index + 1}
                    </td>

                    {/* Description (Tree Node with toggle and indentation) */}
                    <td
                      className="px-3 py-2"
                      style={{ paddingLeft: `${0.75 + depth * 1.75}rem` }}
                    >
                      <div className="flex items-center gap-2">
                        {/* Expand / Collapse toggle or indent spacer */}
                        {hasChildren ? (
                          <button
                            type="button"
                            onClick={() => toggleCollapse(category.id)}
                            className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-surface-raised text-ink-muted hover:text-ink transition-colors focus:outline-none"
                            aria-label={isCollapsed ? `Expand ${category.name}` : `Collapse ${category.name}`}
                          >
                            {isCollapsed ? (
                              <PlusSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <MinusSquare className="w-4 h-4 text-ink-muted" />
                            )}
                          </button>
                        ) : (
                          <span className="w-5 text-center text-ink-faint text-xs select-none">
                            {depth > 0 ? "•" : ""}
                          </span>
                        )}

                        {/* Category Name */}
                        <button
                          type="button"
                          onClick={() =>
                            start(category.id, {
                              name: category.name,
                              description: category.description ?? "",
                            })
                          }
                          className={cn(
                            "text-left hover:underline focus:outline-none",
                            category.level === 1
                              ? "font-semibold text-ink text-sm"
                              : "text-ink-muted text-sm",
                          )}
                        >
                          {category.name}
                        </button>

                        {/* Optional description/code or item count chip */}
                        {category.description && (
                          <span className="text-xs text-ink-faint ml-1 italic">
                            ({category.description})
                          </span>
                        )}

                        {category.itemCount > 0 && (
                          <span className="ml-auto mr-4 text-[11px] font-normal text-ink-faint bg-surface-raised px-1.5 py-0.5 rounded border border-border/50">
                            {category.itemCount} {category.itemCount === 1 ? "item" : "items"}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions: Green (+) Add Child, Pencil (✎) Edit, Trash (🗑️) Delete */}
                    <td className="px-4 py-1.5 text-right whitespace-nowrap w-28">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Green (+) Add Sub-Category Button */}
                        {category.level < 3 && (
                          <button
                            type="button"
                            className="inline-flex items-center justify-center w-7 h-7 rounded-full text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:text-emerald-400 transition-colors focus:outline-none shadow-xs"
                            title={`Add sub category under ${category.name}`}
                            aria-label={`Add sub category under ${category.name}`}
                            onClick={() => start(`new:${category.id}`, { name: "", description: "" })}
                          >
                            <PlusCircle className="w-4 h-4" />
                          </button>
                        )}

                        {/* Edit Pencil (✎) Button */}
                        <button
                          type="button"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-ink-muted hover:text-ink hover:bg-surface-raised transition-colors focus:outline-none"
                          title={`Edit ${category.name}`}
                          aria-label={`Edit ${category.name}`}
                          onClick={() =>
                            start(category.id, {
                              name: category.name,
                              description: category.description ?? "",
                            })
                          }
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Trash Button */}
                        <button
                          type="button"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-ink-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors focus:outline-none opacity-60 group-hover:opacity-100"
                          title={`Delete ${category.name}`}
                          aria-label={`Delete ${category.name}`}
                          onClick={() => setDeleting(category)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm Deletion Dialog */}
      <ConfirmDialog
        open={deleting !== null}
        title="Delete category?"
        message={
          deleting
            ? `Delete "${deleting.name}"? Categories that have sub categories or items cannot be deleted.`
            : ""
        }
        busy={saving}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
