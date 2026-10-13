"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { CONTROL } from "./form-field";

type PageItem = number | "gap";

export function pageItems(page: number, totalPages: number, siblings = 1): PageItem[] {
  if (totalPages <= 0) return [];
  const pages = new Set<number>([1, totalPages]);
  for (let value = page - siblings; value <= page + siblings; value++) {
    if (value >= 1 && value <= totalPages) pages.add(value);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const items: PageItem[] = [];
  sorted.forEach((value, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined && value - previous === 2) items.push(previous + 1);
    else if (previous !== undefined && value - previous > 2) items.push("gap");
    items.push(value);
  });
  return items;
}

export function rangeOf(page: number, pageSize: number, totalRecords: number) {
  if (totalRecords === 0) return { from: 0, to: 0 };
  const from = (page - 1) * pageSize + 1;
  return { from, to: Math.min(page * pageSize, totalRecords) };
}

interface PaginationProps {
  page: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
  pageSizes: readonly number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  disabled?: boolean;
  noun?: string;
  className?: string;
}

export function Pagination({
  page,
  pageSize,
  totalRecords,
  totalPages,
  pageSizes,
  onPageChange,
  onPageSizeChange,
  disabled,
  noun = "records",
  className,
}: PaginationProps) {
  const sizeId = useId();
  const { from, to } = rangeOf(page, pageSize, totalRecords);

  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 text-sm", className)}>
      <p className="text-ink-muted" aria-live="polite">
        Showing <span className="font-medium text-ink tabular-nums">{from}</span>–
        <span className="font-medium text-ink tabular-nums">{to}</span> of{" "}
        <span className="font-medium text-ink tabular-nums">{totalRecords}</span> {noun}
      </p>

      <div className="flex items-center gap-2">
        <label htmlFor={sizeId} className="text-xs whitespace-nowrap text-ink-muted">
          Rows per page
        </label>
        <select
          id={sizeId}
          value={pageSize}
          disabled={disabled}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className={cn(CONTROL, "h-7 w-auto pr-6")}
        >
          {pageSizes.map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </div>

      {totalPages > 0 && (
        <nav aria-label="Pagination" className="flex items-center gap-1 sm:ml-auto">
          <Button size="sm" variant="ghost" disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
            <ChevronLeft /> <span className="hidden sm:inline">Previous</span>
          </Button>
          <ul className="flex items-center gap-1">
            {pageItems(page, totalPages).map((item, index) =>
              item === "gap" ? (
                <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-ink-faint">…</li>
              ) : (
                <li key={item}>
                  <Button
                    size="sm"
                    variant={item === page ? "accent" : "ghost"}
                    className="min-w-7 tabular-nums"
                    disabled={disabled && item !== page}
                    aria-label={`Page ${item}`}
                    aria-current={item === page ? "page" : undefined}
                    onClick={() => item !== page && onPageChange(item)}
                  >
                    {item}
                  </Button>
                </li>
              ),
            )}
          </ul>
          <Button size="sm" variant="ghost" disabled={disabled || page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Next page">
            <span className="hidden sm:inline">Next</span> <ChevronRight />
          </Button>
        </nav>
      )}
    </div>
  );
}
