"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Search,
  Filter,
  Download,
  Printer,
  RefreshCw,
  FileSpreadsheet,
} from "lucide-react";

interface InventoryPageTemplateProps {
  title: string;
  description: string;
  badge?: string;
  primaryActionLabel?: string;
  tableColumns: string[];
  emptyMessage?: string;
  sampleRows?: Array<Record<string, string | number>>;
}

export function InventoryPageTemplate({
  title,
  description,
  badge = "Inventory",
  primaryActionLabel = "New Entry",
  tableColumns,
  emptyMessage = "No records found for the selected criteria.",
  sampleRows = [],
}: InventoryPageTemplateProps) {
  const [search, setSearch] = useState("");

  return (
    <div className="min-h-screen bg-canvas dark:bg-slate-950 p-4 sm:p-6 space-y-5 text-ink dark:text-slate-100">
      {/* Header */}
      <div data-sticky-head className="sticky top-14 z-20 -mx-4 -mt-4 px-4 pt-4 pb-3 sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6 bg-canvas dark:bg-slate-950">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line/80 dark:border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                href="/inventory"
                className="text-xs text-ink-faint hover:text-ink dark:hover:text-slate-200 flex items-center gap-1"
              >
                <ArrowLeft className="size-3.5" />
                <span>Back to Dashboard</span>
              </Link>
              <span className="text-slate-300">/</span>
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                {badge}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink dark:text-slate-100">
              {title}
            </h1>
            <p className="text-xs text-ink-faint dark:text-slate-400">{description}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="h-8 px-3 rounded border border-line dark:border-slate-700 bg-surface dark:bg-slate-900 text-xs font-medium text-ink-muted dark:text-slate-300 hover:bg-canvas flex items-center gap-1.5 shadow-2xs"
            >
              <Download className="size-3.5 text-ink-faint" />
              <span>Export</span>
            </button>
            <button
              type="button"
              className="h-8 px-3 rounded border border-line dark:border-slate-700 bg-surface dark:bg-slate-900 text-xs font-medium text-ink-muted dark:text-slate-300 hover:bg-canvas flex items-center gap-1.5 shadow-2xs"
            >
              <Printer className="size-3.5 text-ink-faint" />
              <span>Print</span>
            </button>
            <button
              type="button"
              className="h-8 px-3.5 rounded bg-[#1877f2] hover:bg-[#166fe5] text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
            >
              <Plus className="size-3.5" />
              <span>{primaryActionLabel}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface dark:bg-slate-900 p-3 rounded-lg border border-line/80 dark:border-slate-800 shadow-2xs">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code, reference or item..."
            className="w-full h-8 pl-8 pr-3 text-xs rounded border border-line dark:border-slate-700 bg-canvas/50 dark:bg-slate-950 focus:border-blue-500 focus:outline-none"
          />
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-ink-faint" />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="h-8 px-3 rounded border border-line dark:border-slate-700 bg-surface dark:bg-slate-900 text-xs text-ink-muted dark:text-slate-400 hover:bg-canvas flex items-center gap-1.5"
          >
            <Filter className="size-3.5 text-ink-faint" />
            <span>Filter</span>
          </button>
          <button
            type="button"
            className="h-8 px-2.5 rounded border border-line dark:border-slate-700 bg-surface dark:bg-slate-900 text-xs text-ink-muted dark:text-slate-400 hover:bg-canvas flex items-center"
          >
            <RefreshCw className="size-3.5 text-ink-faint" />
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="rounded-xl border border-line/80 dark:border-slate-800 bg-surface dark:bg-slate-900 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-canvas dark:bg-slate-800/60 border-b border-line/80 dark:border-slate-800 text-ink-faint dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                {tableColumns.map((col, idx) => (
                  <th key={idx} className="px-4 py-3">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line dark:divide-slate-800">
              {sampleRows.length > 0 ? (
                sampleRows.map((row, rowIdx) => (
                  <tr
                    key={rowIdx}
                    className="hover:bg-canvas/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {Object.values(row).map((val, colIdx) => (
                      <td key={colIdx} className="px-4 py-3 text-ink-muted dark:text-slate-300 font-medium">
                        {String(val)}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={tableColumns.length} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-ink-faint">
                      <FileSpreadsheet className="size-8 stroke-[1.5]" />
                      <span className="text-sm font-medium">{emptyMessage}</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
