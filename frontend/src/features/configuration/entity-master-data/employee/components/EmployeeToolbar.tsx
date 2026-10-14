"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { VIEW_BY_OPTIONS, type EmployeeStatus } from "../schemas/employee.schema";
import { CONTROL_CLASS, Select } from "./kit";

const ALL = "";

export const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;

/** Status tabs; each is a preset of the Status filter, so tabs and dropdown always agree. */
export const QUICK_VIEWS: readonly { label: string; status: EmployeeStatus | undefined }[] = [
  { label: "All Employees", status: undefined },
  { label: "Active", status: "active" },
  { label: "Inactive", status: "inactive" },
];

export interface EmployeeFilters {
  viewBy?: string;
  userType?: string;
  status?: EmployeeStatus;
}

/** Status tab strip shown at the top of the list card. */
export function EmployeeStatusTabs({
  status,
  onChange,
  total,
}: {
  status: EmployeeStatus | undefined;
  onChange: (status: EmployeeStatus | undefined) => void;
  /** Record count of the selected tab, once loaded. */
  total?: number;
}) {
  return (
    <div role="group" aria-label="Status" className="flex gap-6 overflow-x-auto overflow-y-hidden border-b border-line px-5">
      {QUICK_VIEWS.map((view) => {
        const selected = status === view.status;
        return (
          <button
            key={view.label}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(view.status)}
            className={cn(
              "-mb-px inline-flex h-11 items-center gap-2 border-b-2 text-sm whitespace-nowrap transition-colors focus-visible:outline-2",
              selected
                ? "border-accent-strong font-semibold text-accent-strong dark:border-accent dark:text-accent"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {view.label}
            {selected && total !== undefined && (
              <span className="rounded-full bg-accent-soft px-1.5 text-xs font-medium tabular-nums">{total}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface EmployeeToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: EmployeeFilters;
  onFiltersChange: (filters: EmployeeFilters) => void;
  userTypes: readonly string[] | undefined;
  /** Shows "Clear" when any search or filter is applied. */
  onClear?: () => void;
}

export function EmployeeToolbar({ search, onSearchChange, filters, onFiltersChange, userTypes, onClear }: EmployeeToolbarProps) {
  const viewByPending = VIEW_BY_OPTIONS.length === 0;
  const userTypesEmpty = userTypes !== undefined && userTypes.length === 0;

  return (
    <div className="flex flex-col gap-2 px-5 py-3 lg:flex-row lg:items-center">
      <label className="relative w-full lg:max-w-xs">
        <span className="sr-only">Search employees</span>
        <Search aria-hidden="true" className="pointer-events-none absolute top-2 left-2.5 size-4 text-ink-faint" />
        <input
          type="search"
          value={search}
          maxLength={100}
          placeholder="Search ID, name or mobile…"
          title="Searches Employee ID, Attendance ID, name and mobile/user"
          onChange={(event) => onSearchChange(event.target.value)}
          className={cn(CONTROL_CLASS, "pl-8")}
        />
      </label>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex lg:flex-1 lg:items-center">
        <Select
          aria-label="View by"
          title={viewByPending ? "View By options are pending definition." : undefined}
          className="lg:w-48"
          value={filters.viewBy ?? ALL}
          disabled={viewByPending}
          placeholder={viewByPending ? "View by (not set up)" : "View by: All"}
          options={VIEW_BY_OPTIONS}
          onChange={(event) => onFiltersChange({ ...filters, viewBy: event.target.value || undefined })}
        />
        <Select
          aria-label="User type"
          title={userTypesEmpty ? "No employee types recorded yet." : undefined}
          className="lg:w-48"
          value={filters.userType ?? ALL}
          disabled={userTypes === undefined || userTypesEmpty}
          placeholder="User type: All"
          options={userTypes ?? []}
          onChange={(event) => onFiltersChange({ ...filters, userType: event.target.value || undefined })}
        />
        <Select
          aria-label="Status"
          className="lg:w-40"
          value={filters.status ?? ALL}
          placeholder="Status: All"
          options={STATUS_OPTIONS}
          onChange={(event) =>
            onFiltersChange({ ...filters, status: (event.target.value || undefined) as EmployeeStatus | undefined })
          }
        />
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-8 items-center gap-1 rounded px-2 text-sm font-medium text-accent-strong hover:bg-accent-soft focus-visible:outline-2 lg:ml-1 dark:text-accent"
          >
            <X aria-hidden="true" className="size-3.5" /> Clear
          </button>
        )}
      </div>
    </div>
  );
}
