"use client";

import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
  trigger: ReactNode;
  triggerLabel?: string;
  triggerClassName?: string;
  items: readonly MenuItem[];
  align?: "start" | "end";
  /**
   * "fixed" positions the menu against the viewport so it is not clipped by a
   * scrolling ancestor (e.g. a row menu inside a scrollable table). The menu is
   * rendered in a portal on <body> so sticky/pinned cells cannot cover it.
   */
  strategy?: "absolute" | "fixed";
  className?: string;
}

const MENU_GAP = 4;

export function DropdownMenu({
  trigger,
  triggerLabel,
  triggerClassName = buttonClasses("secondary", "md"),
  items,
  align = "end",
  strategy = "absolute",
  className,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    const anchor = triggerRef.current;
    if (!open || strategy !== "fixed" || !menu || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const fitsBelow = rect.bottom + MENU_GAP + menu.offsetHeight <= window.innerHeight;
    menu.style.top = `${fitsBelow ? rect.bottom + MENU_GAP : Math.max(MENU_GAP, rect.top - MENU_GAP - menu.offsetHeight)}px`;
    if (align === "end") menu.style.right = `${window.innerWidth - rect.right}px`;
    else menu.style.left = `${rect.left}px`;

    const dismiss = () => setOpen(false);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [open, strategy, align]);

  const menuItems = () =>
    Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? []);

  const focusItem = (index: number) => {
    const list = menuItems();
    if (list.length === 0) return;
    list[(index + list.length) % list.length]?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const portal = (menu: ReactNode) => (strategy === "fixed" ? createPortal(menu, document.body) : menu);

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
      {open && portal(
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          onKeyDown={onMenuKeyDown}
          className={cn(
            "min-w-44 rounded-lg bg-surface p-1 shadow-dropdown",
            strategy === "fixed"
              ? "fixed z-[60]"
              : ["absolute top-full z-40 mt-1", align === "end" ? "right-0" : "left-0"].join(" "),
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
        </div>,
      )}
    </div>
  );
}
