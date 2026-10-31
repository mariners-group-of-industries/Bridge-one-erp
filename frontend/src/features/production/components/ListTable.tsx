"use client";

import { DataTable } from "@/components/ui/data-table";
import { cn } from "@/lib/cn";

type Props<T> = Parameters<typeof DataTable<T>>[0];

/** "Rows per page" choices; the table opens on the second (50), as in Managerium. */
export const PAGE_SIZES = [25, 50, 100, 200] as const;
/** Managerium's compact rows: every cell on one line (the table scrolls sideways). */
export const ROW_CELL = "whitespace-nowrap py-1.5! align-middle!";

/**
 * A Production list as in Managerium: compact one-line rows and numbered pages
 * ("Rows per page: 50 · 1–50 of N · ‹ ›") instead of "Load more".
 */
export function ListTable<T>({ columns, pages = PAGE_SIZES, ...props }: Props<T>) {
  return <DataTable {...props} pages={pages} columns={columns.map((column) => ({ ...column, className: cn(ROW_CELL, column.className) }))} />;
}
