"use client";

import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";
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
 * Modal built on the native <dialog> element: focus trapping, Escape to close
 * and inert background come from the browser.
 */
export function Dialog({ open, title, description, onClose, children, footer, onSubmit, size = "md" }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const body = (
    <>
      <div className="flex flex-col gap-1 border-b border-zinc-200 px-6 py-4">
        <h2 id={titleId} className="text-lg font-semibold text-zinc-900">
          {title}
        </h2>
        {description && <div className="text-sm text-zinc-600">{description}</div>}
      </div>
      <div className="max-h-[65vh] overflow-y-auto px-6 py-5">{children}</div>
      {footer && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-6 py-3">
          {footer}
        </div>
      )}
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
      className={`m-auto w-[calc(100%-2rem)] rounded-lg bg-white p-0 shadow-xl backdrop:bg-zinc-900/40 ${size === "lg" ? "max-w-2xl" : "max-w-lg"}`}
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
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-zinc-700">{message}</div>
    </Dialog>
  );
}
