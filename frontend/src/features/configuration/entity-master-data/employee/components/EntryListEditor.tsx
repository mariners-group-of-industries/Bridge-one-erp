"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import { EmptyBlock, Notice, Panel, SaveState } from "./kit";

type Keyed<T> = T & { _key: number };
let nextKey = 1;
const withKey = <T,>(row: T): Keyed<T> => ({ ...row, _key: nextKey++ });

interface EntryListEditorProps<T> {
  title: string;
  description: string;
  /** Singular noun for one entry ("Education", "Experience"). */
  itemLabel: string;
  emptyIcon: ReactNode;
  emptyTitle: string;
  /** Saved entries; undefined while loading. */
  saved: T[] | undefined;
  loadError?: Error;
  onRetry: () => void;
  blank: () => T;
  /** Returns an error message for the first invalid entry, or null. */
  validate: (rows: T[]) => string | null;
  save: (rows: T[]) => Promise<unknown>;
  onSaved: () => void;
  renderFields: (row: T, set: (patch: Partial<T>) => void, index: number) => ReactNode;
  /** Extra controls in an entry's header (e.g. a checkbox). */
  renderHeaderExtra?: (row: T, set: (patch: Partial<T>) => void) => ReactNode;
}

/**
 * Editable list of repeating entries (education, previous jobs…). The whole
 * list is saved at once, matching the upsert APIs.
 */
export function EntryListEditor<T extends object>(props: EntryListEditorProps<T>) {
  const { saved, loadError, onRetry, title } = props;

  // Remount the editor whenever fresh data arrives (first load, after save).
  const [seen, setSeen] = useState<T[]>();
  const [version, setVersion] = useState(0);
  if (saved && saved !== seen) {
    setSeen(saved);
    setVersion((value) => value + 1);
  }

  if (loadError) return <Panel title={title}><ErrorState message={loadError.message} onRetry={onRetry} /></Panel>;
  if (!saved) return <Panel title={title}><LoadingState /></Panel>;
  return <Editor key={version} {...props} saved={saved} />;
}

function Editor<T extends object>({
  title,
  description,
  itemLabel,
  emptyIcon,
  emptyTitle,
  saved,
  blank,
  validate,
  save,
  onSaved,
  renderFields,
  renderHeaderExtra,
}: EntryListEditorProps<T> & { saved: T[] }) {
  const toast = useToast();
  const [rows, setRows] = useState<Keyed<T>[]>(() => saved.map(withKey));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = (next: Keyed<T>[]) => {
    setRows(next);
    setDirty(true);
    setError(null);
  };
  const update = (key: number, patch: Partial<T>) => change(rows.map((row) => (row._key === key ? { ...row, ...patch } : row)));
  const add = () => change([...rows, withKey(blank())]);
  const remove = (key: number) => change(rows.filter((row) => row._key !== key));

  const strip = (row: Keyed<T>): T =>
    Object.fromEntries(Object.entries(row).filter(([key]) => key !== "_key")) as T;

  const handleSave = async () => {
    const plain = rows.map(strip);
    const problem = validate(plain);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    try {
      await save(plain);
      toast.success(`${title} saved.`);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pb-6">
      <Panel
        title={title}
        description={description}
        actions={
          <Button variant="accent-soft" onClick={add}>
            <Plus /> Add {itemLabel}
          </Button>
        }
        stickyFooter
        footer={
          <>
            <SaveState dirty={dirty} />
            <Button variant="accent" loading={saving} disabled={!dirty} onClick={handleSave}>
              Save {title}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {error && <Notice tone="error">{error}</Notice>}
          {rows.length === 0 ? (
            <EmptyBlock icon={emptyIcon} title={emptyTitle}>
              <Button size="sm" variant="accent-soft" className="mt-2" onClick={add}>
                <Plus /> Add {itemLabel}
              </Button>
            </EmptyBlock>
          ) : (
            rows.map((row, index) => {
              const set = (patch: Partial<T>) => update(row._key, patch);
              return (
                <fieldset key={row._key} className="rounded-md border border-line">
                  <legend className="sr-only">
                    {itemLabel} {index + 1}
                  </legend>
                  <div className="flex items-center gap-3 border-b border-line bg-canvas px-4 py-2">
                    <span className="flex size-6 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-strong tabular-nums dark:text-accent">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-ink">
                      {itemLabel} {index + 1}
                    </span>
                    <div className="ml-auto flex items-center gap-3">
                      {renderHeaderExtra?.(row, set)}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:text-danger"
                        aria-label={`Remove ${itemLabel.toLowerCase()} ${index + 1}`}
                        onClick={() => remove(row._key)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                  <div className="px-4 py-3">{renderFields(row, set, index)}</div>
                </fieldset>
              );
            })
          )}
        </div>
      </Panel>
    </div>
  );
}
