"use client";

import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface InventoryTab<T extends string> {
  id: T;
  label: string;
}

/**
 * iBOS list header: a light-blue strip of tabs (the open one white with a blue top
 * edge), with search and the page's buttons on the right. Replaces a separate title.
 */
export function InventoryTabBar<T extends string>({
  title,
  tabs,
  active,
  onChange,
  search,
  onSearch,
  actions,
}: {
  /** Accessible name of the page (the strip has no visible title, as in iBOS). */
  title: string;
  tabs: readonly InventoryTab<T>[];
  active: T;
  onChange: (id: T) => void;
  search?: string;
  onSearch?: (value: string) => void;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-stretch justify-between gap-x-3 overflow-hidden rounded-lg border border-line bg-blue-50 dark:bg-blue-500/10">
      <h1 className="sr-only">{title}</h1>
      <div role="tablist" aria-label={title} className="flex flex-wrap">
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(tab.id)}
              className={cn(
                "min-h-10 border-t-2 px-5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500/30 sm:px-7",
                selected ? "border-blue-600 bg-surface font-semibold text-blue-600" : "border-transparent text-ink hover:text-blue-600",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2 px-2 py-1.5">
        {onSearch && (
          <label className="relative">
            <span className="sr-only">Search</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint" aria-hidden />
            <input
              type="search"
              value={search ?? ""}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search..."
              className="h-8 w-52 rounded border border-line bg-surface pl-8 pr-2.5 text-xs text-ink placeholder:text-ink-faint focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-60"
            />
          </label>
        )}
        {actions}
      </div>
    </div>
  );
}

/** iBOS white outlined button on the strip (PDF, Excel). */
export const tabBarOutlineButton =
  "inline-flex h-8 items-center gap-1.5 rounded border border-line bg-surface px-3 text-xs font-semibold text-ink shadow-xs transition-colors hover:bg-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:opacity-60 [&_svg]:size-3.5";

/** iBOS blue action button for the tab strip ("+ Request", "Create", …). */
export const tabBarButton =
  "inline-flex h-8 items-center gap-1.5 rounded bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:opacity-60 [&_svg]:size-3.5";
