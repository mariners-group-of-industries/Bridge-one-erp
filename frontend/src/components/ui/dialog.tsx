"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

interface DialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** When set, the dialog body is a form and the footer's submit button triggers this. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  size?: "md" | "lg";
}

/**
 * ERPNext-style modal built on the native <dialog> element: focus trapping,
 * Escape to close and inert background come from the browser.
 */
export function Dialog({ open, title, description, onClose, children, footer, onSubmit, size = "md" }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    if (!dialog.open) dialog.showModal();
    // Also runs when the route is hidden by <Activity> on navigation, so a modal
    // never stays in the top layer blocking the next page.
    return () => dialog.close();
  }, [open]);

  const body = (
    <>
      <div className="flex items-start gap-3 px-5 pt-4 pb-3">
        <div className="flex flex-1 flex-col gap-1">
          <h2 id={titleId} className="text-lg font-semibold text-ink">
            {title}
          </h2>
          {description && <div className="text-sm text-ink-faint">{description}</div>}
        </div>
        <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
          <X />
        </Button>
      </div>
      <div className="max-h-[65vh] overflow-y-auto px-5 pb-4">{children}</div>
      {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
    </>
  );

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-xl bg-surface p-0 text-ink shadow-dropdown backdrop:bg-black/40",
        size === "lg" ? "max-w-2xl" : "max-w-lg",
      )}
    >
      {open &&
        (onSubmit ? (
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit(event);
            }}
          >
            {body}
          </form>
        ) : (
          body
        ))}
    </dialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  busy,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-ink-muted">{message}</div>
    </Dialog>
  );
}
