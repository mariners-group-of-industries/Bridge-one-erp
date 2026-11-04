"use client";

import { Eye, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { EmployeeFilterOptions, EmployeeStatus } from "../schemas/employee.schema";
import { CONTROL_CLASS, Select } from "./kit";

const ALL = "";
/** Filter controls share one row, so they stay narrow. */
const FILTER_WIDTH = "w-full sm:w-36";

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
  userType?: string;
  status?: EmployeeStatus;
  officeId?: string;
  department?: string;
  designation?: string;
  login?: "yes" | "no";
  joinedFrom?: string;
  joinedTo?: string;
}

const LOGIN_OPTIONS = [
  { value: "yes", label: "Has ERP login" },
  { value: "no", label: "No ERP login" },
];

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
  /** Choices for the filters; undefined while loading or when they failed to load. */
  options: EmployeeFilterOptions | undefined;
  /** Loads the list with the current search and filters (the View button and Enter in the search box). */
  onApply: () => void;
  /** The search or filters differ from what the list shows. */
  pending: boolean;
  /** The list is loading. */
  loading: boolean;
  /** Shows "Clear" when any search or filter is applied. */
  onClear?: () => void;
}

export function EmployeeToolbar({ search, onSearchChange, filters, onFiltersChange, options, onApply, pending, loading, onClear }: EmployeeToolbarProps) {
  const set = <K extends keyof EmployeeFilters>(key: K, value: string) => onFiltersChange({ ...filters, [key]: value || undefined });
  const list = (key: "userType" | "department" | "designation", label: string, choices: readonly string[] | undefined) => (
    <Select
      className={FILTER_WIDTH}
      aria-label={label}
      title={choices?.length === 0 ? `No ${label.toLowerCase()} recorded yet.` : undefined}
      value={filters[key] ?? ALL}
      disabled={!choices?.length}
      placeholder={`${label}: All`}
      options={choices ?? []}
      onChange={(event) => set(key, event.target.value)}
    />
  );
  const rangeInvalid = !!filters.joinedFrom && !!filters.joinedTo && filters.joinedFrom > filters.joinedTo;

  return (
    <div className="flex flex-col gap-2 px-5 py-3">
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
          onKeyDown={(event) => {
            if (event.key === "Enter" && !rangeInvalid) onApply();
          }}
          className={cn(CONTROL_CLASS, "pl-8")}
        />
      </label>

      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
        <Select
          className={FILTER_WIDTH}
          aria-label="Office"
          value={filters.officeId ?? ALL}
          disabled={!options?.offices.length}
          placeholder="Office: All"
          options={options?.offices ?? []}
          onChange={(event) => set("officeId", event.target.value)}
        />
        {list("department", "Department", options?.departments)}
        {list("designation", "Designation", options?.designations)}
        {list("userType", "Employee type", options?.employeeTypes)}
        <Select
          className={FILTER_WIDTH}
          aria-label="ERP login"
          value={filters.login ?? ALL}
          placeholder="ERP login: All"
          options={LOGIN_OPTIONS}
          onChange={(event) => set("login", event.target.value)}
        />
        <Select
          className={FILTER_WIDTH}
          aria-label="Status"
          value={filters.status ?? ALL}
          placeholder="Status: All"
          options={STATUS_OPTIONS}
          onChange={(event) => set("status", event.target.value)}
        />
        <span>Joined</span>
        <input
          type="date"
          aria-label="Joined from"
          value={filters.joinedFrom ?? ""}
          max={filters.joinedTo}
          onChange={(event) => set("joinedFrom", event.target.value)}
          className={cn(CONTROL_CLASS, FILTER_WIDTH)}
        />
        <span>to</span>
        <input
          type="date"
          aria-label="Joined to"
          value={filters.joinedTo ?? ""}
          min={filters.joinedFrom}
          onChange={(event) => set("joinedTo", event.target.value)}
          className={cn(CONTROL_CLASS, FILTER_WIDTH)}
        />
        <Button
          variant={pending ? "accent" : "secondary"}
          loading={loading && !pending}
          disabled={rangeInvalid}
          onClick={onApply}
          title={pending ? "Load the list with these filters" : "Reload the list"}
        >
          {!(loading && !pending) && <Eye />} View
        </Button>
        {rangeInvalid && <span className="text-danger">The start date is after the end date.</span>}
        {pending && !rangeInvalid && <span className="text-xs text-ink-faint">Click View to apply.</span>}
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="ml-auto inline-flex h-8 items-center gap-1 rounded px-2 text-sm font-medium text-accent-strong hover:bg-accent-soft focus-visible:outline-2 dark:text-accent"
          >
            <X aria-hidden="true" className="size-3.5" /> Clear all filters
          </button>
        )}
      </div>
    </div>
  );
}
