"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { TextAreaField } from "@/components/ui/form-field";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import { useResource } from "../hooks/use-resource";
import {
  createTermSchema,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPES_BY_DOMAIN,
  updateTermSchema,
  type TermsDocumentType,
  type TermsDomain,
} from "../schemas/terms.schema";
import { termsApi } from "../services/company-profile.api";
import type { TermDto } from "../types";

interface TermsConditionsTableProps {
  businessUnitId: string;
  domain: TermsDomain;
}

interface Draft {
  content: string;
  isDefault: boolean;
  documentTypes: TermsDocumentType[];
}

const EMPTY_DRAFT: Draft = { content: "", isDefault: false, documentTypes: [] };

/**
 * Database-driven terms & conditions grid shared by Sales and Purchase.
 * The applicable document-type columns come from the domain configuration.
 */
export function TermsConditionsTable({ businessUnitId, domain }: TermsConditionsTableProps) {
  const toast = useToast();
  const terms = useResource(`terms:${businessUnitId}:${domain}`, () =>
    termsApi.list(businessUnitId, domain),
  );
  const documentTypes = DOCUMENT_TYPES_BY_DOMAIN[domain];

  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftError, setDraftError] = useState<string>();
  const [savingDraft, setSavingDraft] = useState(false);
  const [editing, setEditing] = useState<{ id: string; content: string; error?: string } | null>(null);
  const [deleting, setDeleting] = useState<TermDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [reordering, setReordering] = useState(false);

  const setRowPending = (id: string, value: boolean) =>
    setPending((current) => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });

  const replaceRow = (saved: TermDto) =>
    terms.mutate((list = []) => list.map((term) => (term.id === saved.id ? saved : term)));

  /** Optimistic checkbox update; reverts if the server rejects it. */
  async function patchFlags(term: TermDto, patch: { isDefault?: boolean; documentTypes?: TermsDocumentType[] }) {
    if (pending.has(term.id)) return;
    setRowPending(term.id, true);
    replaceRow({ ...term, ...patch });
    try {
      replaceRow(await termsApi.update(term.id, patch));
    } catch (error) {
      replaceRow(term);
      toast.error(errorMessage(error));
    } finally {
      setRowPending(term.id, false);
    }
  }

  function toggleDocumentType(types: TermsDocumentType[], type: TermsDocumentType, checked: boolean) {
    const next = checked ? [...types, type] : types.filter((item) => item !== type);
    // Keep a stable, domain-defined order.
    return documentTypes.filter((item) => next.includes(item));
  }

  async function saveDraft() {
    if (!draft || savingDraft) return;
    const parsed = createTermSchema.safeParse({ domain, ...draft });
    if (!parsed.success) {
      setDraftError(parsed.error.issues[0]?.message);
      return;
    }
    setSavingDraft(true);
    try {
      const created = await termsApi.create(businessUnitId, parsed.data);
      terms.mutate((list = []) => [...list, created]);
      setDraft(null);
      toast.success("Term added.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSavingDraft(false);
    }
  }

  async function saveEdit(term: TermDto) {
    if (!editing || pending.has(term.id)) return;
    const parsed = updateTermSchema.safeParse({ content: editing.content });
    if (!parsed.success) {
      setEditing({ ...editing, error: parsed.error.issues[0]?.message });
      return;
    }
    setRowPending(term.id, true);
    try {
      replaceRow(await termsApi.update(term.id, parsed.data));
      setEditing(null);
      toast.success("Term updated.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRowPending(term.id, false);
    }
  }

  async function move(index: number, offset: -1 | 1) {
    const list = terms.data;
    if (!list || reordering) return;
    const target = index + offset;
    if (target < 0 || target >= list.length) return;

    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    terms.mutate(() => next.map((term, position) => ({ ...term, sortOrder: position + 1 })));
    setReordering(true);
    try {
      const saved = await termsApi.reorder(businessUnitId, domain, next.map((term) => term.id));
      terms.mutate(() => saved);
    } catch (error) {
      toast.error(errorMessage(error));
      terms.reload();
    } finally {
      setReordering(false);
    }
  }

  async function confirmDelete() {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    try {
      await termsApi.remove(deleting.id);
      terms.mutate((list = []) =>
        list
          .filter((term) => term.id !== deleting.id)
          .map((term, position) => ({ ...term, sortOrder: position + 1 })),
      );
      toast.success("Term deleted.");
      setDeleting(null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDeleteBusy(false);
    }
  }

  if (terms.error) return <ErrorState message={terms.error.message} onRetry={terms.reload} />;
  if (!terms.data) return <LoadingState label="Loading terms…" />;

  const list = terms.data;
  const domainLabel = domain === "SALES" ? "sales" : "purchase";
  const headerCell = "px-2 py-2 text-center font-medium";

  return (
    <div className="flex flex-col gap-4">
      {list.length === 0 && !draft ? (
        <EmptyState title={`No ${domainLabel} terms yet`}>
          Add the terms & conditions printed on {domainLabel} documents.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th scope="col" className="w-12 px-2 py-2 text-left font-medium">SL</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">Terms &amp; Conditions</th>
                <th scope="col" className={headerCell}>Default</th>
                {documentTypes.map((type) => (
                  <th key={type} scope="col" className={headerCell}>
                    {DOCUMENT_TYPE_LABELS[type]}
                  </th>
                ))}
                <th scope="col" className="px-2 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {list.map((term, index) => {
                const busy = pending.has(term.id);
                const isEditing = editing?.id === term.id;
                const sl = index + 1;
                return (
                  <tr key={term.id} className="align-top">
                    <td className="px-2 py-3 font-medium text-zinc-700">{sl}</td>
                    <td className="px-2 py-3">
                      {isEditing ? (
                        <div className="flex flex-col gap-2">
                          <TextAreaField
                            label={`Edit term ${sl}`}
                            maxLength={2000}
                            rows={3}
                            autoFocus
                            value={editing.content}
                            error={editing.error}
                            onChange={(event) => setEditing({ id: term.id, content: event.target.value })}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" loading={busy} onClick={() => saveEdit(term)}>
                              Save
                            </Button>
                            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="whitespace-pre-line text-zinc-800">{term.content}</p>
                      )}
                    </td>
                    <td className="px-2 py-3 text-center">
                      <Checkbox
                        label={`Default for term ${sl}`}
                        checked={term.isDefault}
                        disabled={busy}
                        onChange={(checked) => patchFlags(term, { isDefault: checked })}
                      />
                    </td>
                    {documentTypes.map((type) => (
                      <td key={type} className="px-2 py-3 text-center">
                        <Checkbox
                          label={`${DOCUMENT_TYPE_LABELS[type]} for term ${sl}`}
                          checked={term.documentTypes.includes(type)}
                          disabled={busy}
                          onChange={(checked) =>
                            patchFlags(term, {
                              documentTypes: toggleDocumentType(term.documentTypes, type, checked),
                            })
                          }
                        />
                      </td>
                    ))}
                    <td className="px-2 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Move term ${sl} up`}
                          disabled={index === 0 || reordering}
                          onClick={() => move(index, -1)}
                        >
                          ↑
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Move term ${sl} down`}
                          disabled={index === list.length - 1 || reordering}
                          onClick={() => move(index, 1)}
                        >
                          ↓
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy || isEditing}
                          onClick={() => setEditing({ id: term.id, content: term.content })}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-700"
                          disabled={busy}
                          onClick={() => setDeleting(term)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {draft && (
                <tr className="bg-blue-50/50 align-top">
                  <td className="px-2 py-3 font-medium text-zinc-500">{list.length + 1}</td>
                  <td className="px-2 py-3">
                    <TextAreaField
                      label="New term"
                      maxLength={2000}
                      rows={3}
                      autoFocus
                      placeholder="e.g. Payment must be completed within the agreed period."
                      value={draft.content}
                      error={draftError}
                      onChange={(event) => {
                        setDraft({ ...draft, content: event.target.value });
                        setDraftError(undefined);
                      }}
                    />
                  </td>
                  <td className="px-2 py-3 text-center">
                    <Checkbox
                      label="Default for new term"
                      checked={draft.isDefault}
                      onChange={(checked) => setDraft({ ...draft, isDefault: checked })}
                    />
                  </td>
                  {documentTypes.map((type) => (
                    <td key={type} className="px-2 py-3 text-center">
                      <Checkbox
                        label={`${DOCUMENT_TYPE_LABELS[type]} for new term`}
                        checked={draft.documentTypes.includes(type)}
                        onChange={(checked) =>
                          setDraft({
                            ...draft,
                            documentTypes: toggleDocumentType(draft.documentTypes, type, checked),
                          })
                        }
                      />
                    </td>
                  ))}
                  <td className="px-2 py-3">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" loading={savingDraft} onClick={saveDraft}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" disabled={savingDraft} onClick={() => setDraft(null)}>
                        Cancel
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!draft && (
        <div>
          <Button
            variant="secondary"
            onClick={() => {
              setDraft(EMPTY_DRAFT);
              setDraftError(undefined);
            }}
          >
            + Add term
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete term?"
        busy={deleteBusy}
        message={deleting && <p className="whitespace-pre-line">“{deleting.content}” will be permanently deleted.</p>}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function Checkbox({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      className="size-4 cursor-pointer accent-blue-700 disabled:cursor-wait"
    />
  );
}
