"use client";

import React from "react";
import { Filter, RotateCcw, Download, Search } from "lucide-react";

interface FilterToolbarProps {
  children?: React.ReactNode;
  onApply?: () => void;
  onReset?: () => void;
  onExport?: () => void;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  showExport?: boolean;
}

export function FilterToolbar({
  children,
  onApply,
  onReset,
  onExport,
  searchPlaceholder = "Search...",
  searchValue,
  onSearchChange,
  showExport = true,
}: FilterToolbarProps) {
  return (
    <div className="bg-surface p-3 rounded border border-line/90 shadow-2xs mb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Filters and Inputs Group */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
          {onSearchChange !== undefined && (
            <div className="relative min-w-[180px] max-w-[260px] flex-1">
              <Search className="w-3.5 h-3.5 text-ink-faint absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchValue || ""}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 bg-canvas border border-line rounded text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-surface"
              />
            </div>
          )}

          {children}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {onApply && (
            <button
              type="button"
              onClick={onApply}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded text-xs font-semibold shadow-xs transition"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Apply</span>
            </button>
          )}

          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-control hover:bg-hover text-ink-muted rounded text-xs font-medium transition"
              title="Reset Filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          {showExport && onExport && (
            <button
              type="button"
              onClick={onExport}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 rounded text-xs font-medium transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
