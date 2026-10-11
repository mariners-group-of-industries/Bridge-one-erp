"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { buttonClasses } from "./button";

export type MenuItem =
  | {
      label: string;
      icon?: ReactNode;
      danger?: boolean;
      disabled?: boolean;
      onSelect: () => void;
      href?: never;
    }
  | { label: string; icon?: ReactNode; href: string; danger?: never; disabled?: never; onSelect?: never }
  | "separator";

interface DropdownMenuProps {
  /** Content of the trigger button (text and/or icon). */
  trigger: ReactNode;
  /** Accessible name when the trigger has no text (icon-only). */
  triggerLabel?: string;
  /** Classes of the trigger button; defaults to a secondary button. */
  triggerClassName?: string;
  items: readonly MenuItem[];
  align?: "start" | "end";
  className?: string;
}

/** Accessible menu button (WAI-ARIA menu pattern) for "…" actions, user menu, etc. */
export function DropdownMenu({
  trigger,
  triggerLabel,
  triggerClassName = buttonClasses("secondary", "md"),
  items,
  align = "end",
  className,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuItems = () =>
    Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? []);

  const focusItem = (index: number) => {
    const list = menuItems();
    if (list.length === 0) return;
    list[(index + list.length) % list.length]?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function close(restoreFocus = true) {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const list = menuItems();
    const index = list.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown") focusItem(index + 1);
    else if (event.key === "ArrowUp") focusItem(index - 1);
    else if (event.key === "Home") focusItem(0);
    else if (event.key === "End") focusItem(list.length - 1);
    else if (event.key === "Escape") close();
    else if (event.key === "Tab") close(false);
    else return;
    if (event.key !== "Tab") event.preventDefault();
  }

  return (
    <div ref={rootRef} className={cn("relative inline-flex", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={triggerClassName}
        onClick={() => {
          setOpen((value) => !value);
          requestAnimationFrame(() => focusItem(0));
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            const last = event.key === "ArrowUp";
            requestAnimationFrame(() => focusItem(last ? -1 : 0));
          }
        }}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          onKeyDown={onMenuKeyDown}
          className={cn(
            "absolute top-full z-40 mt-1 min-w-44 rounded-lg bg-surface p-1 shadow-dropdown",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {items.map((item, index) => {
            if (item === "separator") {
              return <div key={`separator-${index}`} role="separator" className="my-1 h-px bg-line" />;
            }
            const classes = cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none focus:bg-control hover:bg-control disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4 [&_svg]:text-ink-faint",
              item.danger ? "text-danger" : "text-ink",
            );
            return item.href ? (
              <Link
                key={item.label}
                href={item.href}
                role="menuitem"
                tabIndex={-1}
                className={classes}
                onClick={() => setOpen(false)}
              >
                {item.icon}
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                tabIndex={-1}
                disabled={item.disabled}
                className={classes}
                onClick={() => {
                  close();
                  item.onSelect?.();
                }}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
