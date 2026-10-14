"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

export interface DialogProps {
  open: boolean;
  title?: string;
  description?: ReactNode;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  footer?: ReactNode;
  /** When set, the dialog body is a form and the footer's submit button triggers this. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  size?: "md" | "lg" | "xl";
  className?: string;
}

/**
 * ERPNext-style modal built on the native <dialog> element: focus trapping,
 * Escape to close and inert background come from the browser.
 * Supports both props-based usage (<Dialog open title="..." onClose={...}>)
 * and composable compound subcomponents (<DialogContent>, <DialogHeader>, etc.).
 */
export function Dialog({
  open,
  title,
  description,
  onClose,
  onOpenChange,
  children,
  footer,
  onSubmit,
  size = "md",
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const handleClose = () => {
    onClose?.();
    onOpenChange?.(false);
  };

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
    }
  }, [open]);

  const isComposable = !title;

  const standardBody = (
    <>
      <div className="flex items-start gap-3 px-5 pt-4 pb-3">
        <div className="flex flex-1 flex-col gap-1">
          {title && (
            <h2 id={titleId} className="text-lg font-semibold text-ink">
              {title}
            </h2>
          )}
          {description && <div className="text-sm text-ink-faint">{description}</div>}
        </div>
        <Button variant="ghost" size="icon" aria-label="Close" onClick={handleClose}>
          <X className="size-4" />
        </Button>
      </div>
      <div className={cn("overflow-x-hidden overflow-y-auto px-5 pb-4", size === "xl" ? "max-h-[75vh]" : "max-h-[65vh]")}>
        {children}
      </div>
      {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
    </>
  );

  const composableBody = (
    <div className="relative max-h-[85vh] overflow-y-auto">
      <button
        type="button"
        onClick={handleClose}
        aria-label="Close"
        className="absolute top-4 right-4 z-10 rounded-md p-1.5 text-ink-muted hover:bg-surface-sunken hover:text-ink transition-colors"
      >
        <X className="size-4" />
      </button>
      {children}
    </div>
  );

  const content = isComposable ? composableBody : standardBody;

  return (
    <dialog
      ref={ref}
      aria-labelledby={title ? titleId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        handleClose();
      }}
      className={cn(
        // The body scrolls, not the <dialog> itself (avoids a second scrollbar).
        "m-auto w-[calc(100%-2rem)] overflow-hidden rounded-xl bg-surface p-0 text-ink shadow-dropdown backdrop:bg-black/40",
        size === "xl" ? "max-w-5xl" : size === "lg" ? "max-w-2xl" : "max-w-lg",
        className,
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
            {content}
          </form>
        ) : (
          content
        ))}
    </dialog>
  );
}

export function DialogContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("p-6", className)}>{children}</div>;
}

export function DialogHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("mb-4 flex flex-col gap-1 pr-6", className)}>{children}</div>;
}

export function DialogTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <h2 className={cn("text-lg font-semibold text-ink leading-tight", className)}>{children}</h2>;
}

export function DialogDescription({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("text-xs text-ink-muted leading-relaxed", className)}>{children}</div>;
}

export function DialogFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3", className)}>{children}</div>;
}

export interface ConfirmDialogProps {
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
