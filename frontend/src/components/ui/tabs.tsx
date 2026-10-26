"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  /** Small count shown after the label. */
  badge?: ReactNode;
}

interface TabsProps<T extends string> {
  tabs: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  /** @deprecated Every tab bar now uses the blue accent underline; kept for existing callers. */
  tone?: "default" | "accent";
  /** Content of the selected tab. */
  children: ReactNode;
  className?: string;
}

/**
 * ERPNext form tabs (underlined) plus the selected panel. Follows the WAI-ARIA
 * tabs pattern: arrow keys, Home and End move between tabs.
 */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  children,
  className,
}: TabsProps<T>) {
  const baseId = useId();
  const refs = useRef(new Map<T, HTMLButtonElement>());
  const tabId = (id: T) => `${baseId}-tab-${id}`;
  const panelId = `${baseId}-panel`;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((tab) => tab.id === value);
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    if (next === null) return;
    event.preventDefault();
    onChange(tabs[next].id);
    refs.current.get(tabs[next].id)?.focus();
  }

  return (
    <>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className={cn("flex gap-5 overflow-x-auto overflow-y-hidden border-b border-line px-5", className)}
      >
        {tabs.map((tab) => {
          const selected = tab.id === value;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                if (element) refs.current.set(tab.id, element);
                else refs.current.delete(tab.id);
              }}
              type="button"
              role="tab"
              id={tabId(tab.id)}
              aria-selected={selected}
              aria-controls={selected ? panelId : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              className={cn(
                "-mb-px inline-flex items-center gap-1.5 border-b-2 py-2.5 text-xs font-bold tracking-wide whitespace-nowrap uppercase transition-colors focus-visible:outline-2",
                !selected && "border-transparent text-ink-faint hover:text-ink",
                // Both tones use the blue underline of the Purchase module.
                selected && "border-accent-strong text-accent-strong dark:border-accent dark:text-accent",
              )}
            >
              {tab.label}
              {tab.badge !== undefined && (
                <span
                  className={cn(
                    "rounded px-1.5 text-[10px]",
                    selected ? "bg-accent-soft text-accent-strong dark:text-accent" : "bg-control text-ink-muted",
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={panelId} aria-labelledby={tabId(value)}>
        {children}
      </div>
    </>
  );
}
