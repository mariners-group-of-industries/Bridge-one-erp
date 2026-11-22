"use client";

import { Check, CheckCircle2, CircleAlert, ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, TextAreaField } from "@/components/ui/form-field";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { canDecideHere, decide, fetchPendingDocuments, type Decision } from "../services/decisions";
import type { ApprovalCategory, PendingListDocument } from "../types";

type RowResult = { ok: true; decision: Decision } | { ok: false; message: string };

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

function age(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "1 day" : `${days} days`;
}

/**
 * The pending documents of one approval category, decided right here: select
 * rows, then approve or reject them. Each decision runs through the module's
 * own endpoint, so the module page shows the new status too.
 */
export function ApprovalQueueDialog({ category, onClose, onDecided }: { category: ApprovalCategory | null; onClose: () => void; onDecided: () => void }) {
  return (
    <Dialog
      open={!!category}
      onClose={onClose}
      size="xl"
      title={category ? `${category.label} — pending approval` : ""}
      description={category ? `${category.module} · approving here updates the ${category.label} page as well.` : undefined}
    >
      {category && <Queue key={category.id} category={category} onDecided={onDecided} />}
    </Dialog>
  );
}

function Queue({ category, onDecided }: { category: ApprovalCategory; onDecided: () => void }) {
  const list = useResource(`approval-pending:${category.id}`, () => fetchPendingDocuments(category.id));
  const toast = useToast();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState<Decision | null>(null);
  const [results, setResults] = useState<Map<string, RowResult>>(new Map());
  const [remarksError, setRemarksError] = useState<string | undefined>();

  const docs = useMemo(() => list.data?.documents ?? [], [list.data]);
  const canApprove = canDecideHere(category.id, "approve");
  const canReject = canDecideHere(category.id, "reject");
  const multiStage = !!category.pipeline && category.pipeline.stages > 1;

  // Only documents still in the list count as selected (some may have left after a reload).
  const selected = useMemo(() => {
    const ids = new Set(docs.map((d) => d.id));
    return new Set([...picked].filter((id) => ids.has(id)));
  }, [docs, picked]);

  const allSelected = docs.length > 0 && selected.size === docs.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function run(decision: Decision) {
    const chosen = docs.filter((d) => selected.has(d.id));
    if (chosen.length === 0) return;
    if (decision === "reject" && !remarks.trim()) {
      setRemarksError("Give a reason for the rejection.");
      return;
    }
    setRemarksError(undefined);
    setBusy(decision);
    const next = new Map(results);
    let done = 0;
    // One at a time: several approvals of the same pipeline stage must not race each other.
    for (const doc of chosen) {
      try {
        await decide(category.id, decision, { doc, remarks: remarks.trim() });
        next.set(doc.id, { ok: true, decision });
        done += 1;
      } catch (error) {
        next.set(doc.id, { ok: false, message: errorMessage(error) });
      }
    }
    setResults(next);
    setBusy(null);
    const failed = chosen.length - done;
    const verb = decision === "approve" ? "approved" : "rejected";
    if (done > 0) toast.success(`${done} ${category.label.toLowerCase()} ${done === 1 ? "document" : "documents"} ${verb}.`);
    if (failed > 0) toast.error(`${failed} could not be ${verb}. See the rows marked in red.`);
    if (done > 0) {
      setPicked(new Set(chosen.filter((d) => next.get(d.id)?.ok === false).map((d) => d.id)));
      if (decision === "reject") setRemarks("");
      list.reload();
      onDecided();
    }
  }

  if (list.error && !list.data) return <ErrorState message={errorMessage(list.error)} onRetry={list.reload} />;
  if (!list.data) return <LoadingState label="Loading pending documents…" />;

  // Decided rows still listed after the reload: a pipeline stage cleared (not the last), or a failure.
  const resultOf = (doc: PendingListDocument) => results.get(doc.id);

  return (
    <div className="flex flex-col gap-3 pt-1">
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
        <span>
          <span className="font-semibold text-ink tabular-nums">{docs.length}</span> pending
          {list.data.truncated && " (oldest shown first; refresh after deciding to see more)"}
        </span>
        {category.pipeline && (
          <Badge variant="primary">
            {category.pipeline.name} · {category.pipeline.stages}-stage
          </Badge>
        )}
        <Link href={category.href} className={cn(buttonClasses("ghost", "sm"), "ml-auto min-h-8")}>
          Open {category.label} page
          <ExternalLink aria-hidden="true" />
        </Link>
      </div>

      {multiStage && (
        <p className="rounded border border-line bg-canvas px-3 py-2 text-xs text-ink-muted">
          This category has a {category.pipeline!.stages}-stage pipeline. Approving clears your stage; a document stays here until its last stage approves.
        </p>
      )}

      {docs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
          <CheckCircle2 aria-hidden="true" className="size-6 text-success" />
          <p className="text-sm font-semibold text-ink">Nothing is waiting</p>
          <p className="text-xs text-ink-muted">No {category.label.toLowerCase()} is pending approval.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-line">
          <table className="w-full min-w-[32rem] text-left text-[13px]">
            <thead className="bg-canvas text-xs font-medium text-ink-muted">
              <tr className="border-b border-line">
                <th scope="col" className="w-10 px-2 py-1.5">
                  <label className="flex size-8 cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      className="size-4 cursor-pointer rounded accent-(--accent-strong) disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={allSelected ? "Clear selection" : "Select all"}
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected;
                      }}
                      disabled={!!busy}
                      onChange={() => setPicked(allSelected ? new Set() : new Set(docs.map((d) => d.id)))}
                    />
                  </label>
                </th>
                <th scope="col" className="px-2 py-1.5">
                  Reference
                </th>
                <th scope="col" className="px-2 py-1.5">
                  Submitted
                </th>
                <th scope="col" className="px-2 py-1.5 text-right">
                  Waiting
                </th>
                <th scope="col" className="px-2 py-1.5">
                  Result
                </th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => {
                const checked = selected.has(doc.id);
                const result = resultOf(doc);
                return (
                  <tr key={doc.id} className={cn("border-b border-line last:border-b-0", checked ? "bg-accent-soft/50" : "hover:bg-canvas")}>
                    <td className="px-2 py-1">
                      <label className="flex size-8 cursor-pointer items-center justify-center">
                        <Checkbox tone="accent" aria-label={`Select ${doc.reference}`} checked={checked} disabled={!!busy} onChange={() => toggle(doc.id)} />
                      </label>
                    </td>
                    <td className="px-2 py-1 font-mono text-xs font-semibold text-ink">
                      <button type="button" onClick={() => toggle(doc.id)} disabled={!!busy} className="min-h-6 text-left hover:text-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2">
                        {doc.reference}
                      </button>
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap text-ink-muted">{dateFmt.format(new Date(doc.createdAt))}</td>
                    <td className="px-2 py-1 text-right whitespace-nowrap text-ink-muted tabular-nums">{age(doc.createdAt)}</td>
                    <td className="px-2 py-1 text-xs">
                      {!result ? (
                        <span className="text-ink-faint">—</span>
                      ) : result.ok ? (
                        <span className="inline-flex items-center gap-1 text-success">
                          <Check aria-hidden="true" className="size-3.5" />
                          {result.decision === "approve" ? "Stage approved" : "Rejected"}
                        </span>
                      ) : (
                        <span className="inline-flex items-start gap-1 text-danger">
                          <CircleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                          <span className="line-clamp-2">{result.message}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {docs.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          <TextAreaField
            label={canReject ? "Remarks (required to reject)" : "Remarks"}
            value={remarks}
            onChange={(e) => {
              setRemarks(e.target.value);
              if (remarksError) setRemarksError(undefined);
            }}
            maxLength={500}
            rows={2}
            error={remarksError}
            disabled={!!busy}
            placeholder="Shown on the document's approval history"
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto text-xs text-ink-muted tabular-nums" aria-live="polite">
              {selected.size} selected
            </span>
            {canReject ? (
              <Button variant="secondary" className="min-h-11 sm:min-h-8" disabled={selected.size === 0 || !!busy} loading={busy === "reject"} onClick={() => run("reject")}>
                {busy !== "reject" && <X aria-hidden="true" />}
                Reject{selected.size > 0 && ` (${selected.size})`}
              </Button>
            ) : (
              <span className="text-xs text-ink-faint">Rejecting is done on the {category.label} page.</span>
            )}
            {canApprove && (
              <Button variant="primary" className="min-h-11 sm:min-h-8" disabled={selected.size === 0 || !!busy} loading={busy === "approve"} onClick={() => run("approve")}>
                {busy !== "approve" && <Check aria-hidden="true" />}
                Approve{selected.size > 0 && ` (${selected.size})`}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
