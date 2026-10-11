"use client";

import { ArrowDownNarrowWide, ArrowUpNarrowWide, ChevronDown, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatDateTime, shortTimeAgo } from "@/lib/format";
import { Button, buttonClasses } from "./button";
import { DropdownMenu, type MenuItem } from "./dropdown-menu";
import { CONTROL, Checkbox } from "./form-field";
import { EmptyState } from "./section";

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Makes the column sortable. */
  sortValue?: (row: T) => string | number;
  className?: string;
  /** Hide on narrow screens. */
  hideBelow?: "sm" | "md" | "lg";
}

interface DataTableProps<T> {
  rows: readonly T[];
  columns: readonly Column<T>[];
  getRowId: (row: T) => string;
  /** Opens the record when the row is clicked. */
  rowHref?: (row: T) => string;
  /** Label of the row for screen readers / selection checkboxes. */
  getRowLabel: (row: T) => string;
  search?: { placeholder: string; match: (row: T, query: string) => boolean };
  /** ISO timestamp shown as a compact age in the last column ("Last Updated On" sort). */
  modifiedAt?: (row: T) => string;
  /** Actions for the selected rows (shown when any row is checked). */
  bulkActions?: (selected: T[], clearSelection: () => void) => MenuItem[];
  emptyState?: ReactNode;
}

const PAGE_SIZES = [20, 100, 500] as const;
const MODIFIED = "__modified";

const HIDE: Record<NonNullable<Column<unknown>["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
};

/**
 * ERPNext list view body: search, sort, selection with bulk actions and
 * "load more" paging. Data is filtered client-side.
 */
export function DataTable<T>({
  rows,
  columns,
  getRowId,
  rowHref,
  getRowLabel,
  search,
  modifiedAt,
  bulkActions,
  emptyState,
}: DataTableProps<T>) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const sortable = useMemo(() => columns.filter((column) => column.sortValue), [columns]);
  const [sortBy, setSortBy] = useState<string>(modifiedAt ? MODIFIED : (sortable[0]?.id ?? ""));
  const [descending, setDescending] = useState(true);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [visible, setVisible] = useState<number>(PAGE_SIZES[0]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = needle && search ? rows.filter((row) => search.match(row, needle)) : [...rows];
    const valueOf =
      sortBy === MODIFIED && modifiedAt
        ? (row: T) => modifiedAt(row)
        : sortable.find((column) => column.id === sortBy)?.sortValue;
    if (valueOf) {
      matches.sort((a, b) => {
        const left = valueOf(a);
        const right = valueOf(b);
        const order =
          typeof left === "number" && typeof right === "number"
            ? left - right
            : String(left).localeCompare(String(right), undefined, { numeric: true });
        return descending ? -order : order;
      });
    }
    return matches;
  }, [rows, query, search, sortBy, descending, sortable, modifiedAt]);

  const shown = filtered.slice(0, visible);
  const ids = new Set(rows.map(getRowId));
  const selectedRows = rows.filter((row) => selected.has(getRowId(row)));
  // Derived from `rows`, so deleted or reloaded-away rows drop out of the selection.
  const selectedCount = selectedRows.length;
  const allShownSelected = shown.length > 0 && shown.every((row) => selected.has(getRowId(row)));
  const clearSelection = () => setSelected(new Set());

  const toggleRow = (id: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set([...current].filter((value) => ids.has(value)));
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const toggleAll = (checked: boolean) =>
    setSelected(checked ? new Set(shown.map(getRowId)) : new Set());

  function openRow(event: MouseEvent<HTMLTableRowElement>, row: T) {
    if (!rowHref) return;
    const target = event.target as HTMLElement;
    if (target.closest("a, button, input, label")) return;
    router.push(rowHref(row));
  }

  const sortOptions = [
    ...(modifiedAt ? [{ id: MODIFIED, label: "Last Updated On" }] : []),
    ...sortable.map((column) => ({ id: column.id, label: column.header })),
  ];

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
        {search && (
          <label className="relative w-full sm:w-56">
            <span className="sr-only">{search.placeholder}</span>
            <Search aria-hidden="true" className="pointer-events-none absolute top-1.5 left-2 size-4 text-ink-faint" />
            <input
              type="search"
              value={query}
              placeholder={search.placeholder}
              onChange={(event) => {
                setQuery(event.target.value);
                setVisible(pageSize);
              }}
              className={cn(CONTROL, "h-7 pl-7")}
            />
          </label>
        )}
        {sortOptions.length > 0 && (
          <div className="ml-auto flex items-center">
            <Button
              size="icon"
              className="rounded-r-none"
              aria-label={descending ? "Sorted descending, switch to ascending" : "Sorted ascending, switch to descending"}
              onClick={() => setDescending((value) => !value)}
            >
              {descending ? <ArrowDownNarrowWide /> : <ArrowUpNarrowWide />}
            </Button>
            <label className="relative">
              <span className="sr-only">Sort by</span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="h-7 appearance-none rounded-l-none rounded-r-lg border-l border-line bg-control pr-7 pl-2 text-xs font-medium text-ink hover:bg-hover focus-visible:outline-2"
              >
                {sortOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1.5 right-2 size-4 text-ink-faint" />
            </label>
          </div>
        )}
      </div>

      {rows.length === 0 || filtered.length === 0 ? (
        rows.length === 0 ? (
          (emptyState ?? <EmptyState title="Nothing here yet" />)
        ) : (
          <EmptyState title="No matching records">Try a different search.</EmptyState>
        )
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-ink-faint">
              <tr className="border-b border-line">
                <th scope="col" className="w-10 py-2 pl-4">
                  <Checkbox
                    aria-label="Select all rows"
                    checked={allShownSelected}
                    onChange={(event) => toggleAll(event.target.checked)}
                  />
                </th>
                {columns.map((column, index) => (
                  <th
                    key={column.id}
                    scope="col"
                    className={cn("py-2 pr-4 font-normal", column.hideBelow && HIDE[column.hideBelow], column.className)}
                  >
                    {index === 0 && selectedCount > 0 ? (
                      <span className="flex items-center gap-3">
                        <span className="font-medium text-ink">{selectedCount} selected</span>
                        {bulkActions && (
                          <DropdownMenu
                            align="start"
                            items={bulkActions(selectedRows, clearSelection)}
                            trigger={
                              <>
                                Actions <ChevronDown />
                              </>
                            }
                            triggerClassName={buttonClasses("secondary", "sm")}
                          />
                        )}
                      </span>
                    ) : (
                      column.header
                    )}
                  </th>
                ))}
                {modifiedAt && (
                  <th scope="col" className="py-2 pr-4 text-right font-normal">
                    {shown.length} of {filtered.length}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => {
                const id = getRowId(row);
                const isSelected = selected.has(id);
                return (
                  <tr
                    key={id}
                    onClick={(event) => openRow(event, row)}
                    className={cn(
                      "border-b border-line last:border-b-0 hover:bg-canvas",
                      rowHref && "cursor-pointer",
                      isSelected && "bg-canvas",
                    )}
                  >
                    <td className="py-2.5 pl-4 align-top">
                      <Checkbox
                        aria-label={`Select ${getRowLabel(row)}`}
                        checked={isSelected}
                        onChange={(event) => toggleRow(id, event.target.checked)}
                      />
                    </td>
                    {columns.map((column) => (
                      <td
                        key={column.id}
                        className={cn(
                          "py-2.5 pr-4 align-top text-ink-muted",
                          column.hideBelow && HIDE[column.hideBelow],
                          column.className,
                        )}
                      >
                        {column.cell(row)}
                      </td>
                    ))}
                    {modifiedAt && (
                      <td className="py-2.5 pr-4 text-right align-top text-xs whitespace-nowrap text-ink-faint">
                        <time dateTime={modifiedAt(row)} title={formatDateTime(modifiedAt(row))}>
                          {shortTimeAgo(modifiedAt(row))}
                        </time>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2.5">
          <div role="group" aria-label="Rows per page" className="flex">
            {PAGE_SIZES.map((size, index) => (
              <Button
                key={size}
                size="sm"
                aria-pressed={pageSize === size}
                className={cn(
                  index === 0 ? "rounded-r-none" : index === PAGE_SIZES.length - 1 ? "rounded-l-none" : "rounded-none",
                  pageSize === size && "bg-hover text-ink",
                )}
                onClick={() => {
                  setPageSize(size);
                  setVisible(size);
                }}
              >
                {size}
              </Button>
            ))}
          </div>
          {visible < filtered.length && (
            <Button size="sm" className="ml-auto" onClick={() => setVisible((value) => value + pageSize)}>
              Load more
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
