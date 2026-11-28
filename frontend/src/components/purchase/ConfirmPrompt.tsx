"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

/**
 * The reference ERP's yes/no confirmation: one question, a close icon and
 * NO / YES text buttons. YES shows a spinner while the action runs.
 */
export function ConfirmPrompt({
  open,
  question,
  detail,
  pending = false,
  onNo,
  onYes,
}: {
  open: boolean;
  question: string;
  /** Optional line under the question, e.g. the document code. */
  detail?: string;
  pending?: boolean;
  onNo: () => void;
  onYes: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onNo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onNo]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => !pending && onNo()}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-prompt-question"
        className="w-full max-w-xl rounded bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <h2 id="confirm-prompt-question" className="text-lg font-medium text-ink">
            {question}
          </h2>
          <button
            type="button"
            onClick={onNo}
            disabled={pending}
            aria-label="Close"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded text-ink hover:bg-hover disabled:opacity-50"
          >
            <X className="size-5" />
          </button>
        </div>
        {detail && <p className="px-6 pt-3 text-sm text-ink-muted">{detail}</p>}
        <div className="flex justify-end gap-2 px-4 pb-4 pt-8">
          <button type="button" onClick={onNo} disabled={pending} className="h-9 min-w-16 px-4 rounded text-sm font-medium uppercase text-ink-muted hover:bg-hover disabled:opacity-50">
            No
          </button>
          <button
            type="button"
            onClick={onYes}
            disabled={pending}
            autoFocus
            className="h-9 min-w-16 px-4 rounded text-sm font-medium uppercase text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
          >
            {pending && <Spinner className="size-3.5" />}
            Yes
          </button>
        </div>
      </div>
    </div>
  );
}
