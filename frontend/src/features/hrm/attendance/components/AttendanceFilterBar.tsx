"use client";

import { RefreshCw } from "lucide-react";
import { DateInput } from "@/components/ui/date-input";
import type { AttendanceFilterState, EmployeeOption } from "../types";

interface AttendanceFilterBarProps {
  filters: AttendanceFilterState;
  onChange: (patch: Partial<AttendanceFilterState>) => void;
  onView: () => void;
  employees: EmployeeOption[];
  loading?: boolean;
}

/** Employee attributes the list can be narrowed by, after Office. */
const ATTR_FILTERS = [
  { key: "department", label: "Department", all: "All Departments" },
  { key: "departmentSection", label: "Section", all: "All Sections" },
  { key: "designation", label: "Designation", all: "All Designations" },
] as const;
type AttrKey = (typeof ATTR_FILTERS)[number]["key"];

const CONTROL = "w-full h-8 text-xs rounded border border-line-strong bg-surface px-2.5 text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs";

export function AttendanceFilterBar({
  filters,
  onChange,
  onView,
  employees,
  loading = false,
}: AttendanceFilterBarProps) {
  // Offices of the employees on the list, and the employees of the chosen office.
  const offices = [...new Map(employees.filter((e) => e.officeId).map((e) => [e.officeId, e.officeName])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const officeEmployees = filters.officeId === "ALL" ? employees : employees.filter((e) => e.officeId === filters.officeId);

  const chosen = (key: AttrKey) => (filters[key] && filters[key] !== "ALL" ? filters[key]! : "");
  /** Employees of the office matching every chosen attribute, optionally ignoring one (for that dropdown's own options). */
  const matching = (except?: AttrKey) => officeEmployees.filter((e) => ATTR_FILTERS.every((f) => f.key === except || !chosen(f.key) || e[f.key] === chosen(f.key)));
  const attrOptions = (key: AttrKey) => [...new Set(matching(key).map((e) => e[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const employeeOptions = matching();

  function setAttr(key: AttrKey, value: string) {
    const next = { ...filters, [key]: value };
    const stillListed = officeEmployees.some(
      (e) => e.employeeCode === filters.employeeId && ATTR_FILTERS.every((f) => !next[f.key] || next[f.key] === "ALL" || e[f.key] === next[f.key]),
    );
    // A chosen employee outside the new filter would leave the table empty: go back to all employees.
    onChange({ [key]: value, ...(filters.employeeId !== "ALL" && !stillListed ? { employeeId: "ALL" } : {}) });
  }

  return (
    <div className="rounded-md border border-accent-line/60 bg-[#f4f8fe]/80 dark:bg-[#0c162c]/50 p-3 shadow-2xs">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3 items-end">
        {/* From Date */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-ink">From Date</label>
          <div className="relative">
            <DateInput
              aria-label="From Date"
              value={filters.fromDate}
              onChange={(iso) => onChange({ fromDate: iso })}
              className="w-full h-8 text-xs rounded border border-line-strong bg-surface px-2.5 text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
            />
          </div>
        </div>

        {/* To Date */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-ink">To Date</label>
          <div className="relative">
            <DateInput
              aria-label="To Date"
              value={filters.toDate}
              onChange={(iso) => onChange({ toDate: iso })}
              className="w-full h-8 text-xs rounded border border-line-strong bg-surface px-2.5 text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
            />
          </div>
        </div>

        {/* View By */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-ink">View By</label>
          <select
            value={filters.viewBy}
            onChange={(e) => onChange({ viewBy: e.target.value as any })}
            className="w-full h-8 text-xs rounded border border-line-strong bg-surface px-2.5 text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
          >
            <option value="Employee">Employee</option>
            <option value="Department">Department</option>
            <option value="Date">Date</option>
            <option value="All">All</option>
          </select>
        </div>

        {/* Office */}
        <div className="space-y-1">
          <label htmlFor="attendance-office" className="text-[11px] font-semibold text-ink">Office</label>
          <select
            id="attendance-office"
            value={filters.officeId}
            // An employee picked for another office would leave the table empty.
            onChange={(e) => onChange({ officeId: e.target.value, employeeId: "ALL", department: "ALL", departmentSection: "ALL", designation: "ALL" })}
            className="w-full h-8 text-xs rounded border border-line-strong bg-surface px-2.5 text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
          >
            <option value="ALL">All Offices</option>
            {offices.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* Department / Section / Designation */}
        {ATTR_FILTERS.map((f) => (
          <div key={f.key} className="space-y-1">
            <label htmlFor={`attendance-${f.key}`} className="text-[11px] font-semibold text-ink">{f.label}</label>
            <select id={`attendance-${f.key}`} value={chosen(f.key) || "ALL"} onChange={(e) => setAttr(f.key, e.target.value)} className={CONTROL}>
              <option value="ALL">{f.all}</option>
              {attrOptions(f.key).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        ))}

        {/* Employee */}
        <div className="space-y-1">
          <label htmlFor="attendance-employee" className="text-[11px] font-semibold text-ink">Employee ({employeeOptions.length})</label>
          <select
            id="attendance-employee"
            value={filters.employeeId}
            onChange={(e) => onChange({ employeeId: e.target.value })}
            className="w-full h-8 text-xs rounded border border-line-strong bg-surface px-2.5 text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
          >
            <option value="ALL">All Employees</option>
            {employeeOptions.map((emp) => (
              <option key={emp.id} value={emp.employeeCode}>
                {emp.employeeCode} - {emp.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-ink">Status</label>
          <select
            value={filters.status}
            onChange={(e) => onChange({ status: e.target.value })}
            className="w-full h-8 text-xs rounded border border-line-strong bg-surface px-2.5 text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
          >
            <option value="ALL">All</option>
            <option value="Present">Present</option>
            <option value="Late">Late</option>
            <option value="Absent">Absent</option>
            <option value="Offday">Offday</option>
            <option value="Holiday">Holiday</option>
            <option value="Leave">Leave</option>
          </select>
        </div>

        {/* View Button */}
        <div>
          <button
            type="button"
            onClick={onView}
            disabled={loading}
            className="inline-flex items-center justify-center w-full h-8 px-5 rounded font-semibold text-xs text-white bg-primary hover:bg-primary-hover shadow-xs transition-colors cursor-pointer disabled:opacity-60"
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <RefreshCw className="size-3.5 animate-spin" />
                Loading...
              </span>
            ) : (
              "View"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
