"use client";

import { Search, Calendar, RefreshCw } from "lucide-react";
import type { AttendanceFilterState, EmployeeOption } from "../types";

interface AttendanceFilterBarProps {
  filters: AttendanceFilterState;
  onChange: (patch: Partial<AttendanceFilterState>) => void;
  onView: () => void;
  employees: EmployeeOption[];
  loading?: boolean;
}

export function AttendanceFilterBar({
  filters,
  onChange,
  onView,
  employees,
  loading = false,
}: AttendanceFilterBarProps) {
  return (
    <div className="rounded-md border border-accent-line/60 bg-[#f4f8fe]/80 dark:bg-[#0c162c]/50 p-3 shadow-2xs">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
        {/* From Date */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-ink">From Date</label>
          <div className="relative">
            <input
              type="date"
              value={filters.fromDate}
              onChange={(e) => onChange({ fromDate: e.target.value })}
              className="w-full h-8 text-xs rounded border border-line-strong bg-surface px-2.5 text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
            />
          </div>
        </div>

        {/* To Date */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-ink">To Date</label>
          <div className="relative">
            <input
              type="date"
              value={filters.toDate}
              onChange={(e) => onChange({ toDate: e.target.value })}
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

        {/* Employee */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-ink">Employee</label>
          <select
            value={filters.employeeId}
            onChange={(e) => onChange({ employeeId: e.target.value })}
            className="w-full h-8 text-xs rounded border border-line-strong bg-surface px-2.5 text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
          >
            <option value="ALL">All Employees</option>
            {employees.map((emp) => (
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
