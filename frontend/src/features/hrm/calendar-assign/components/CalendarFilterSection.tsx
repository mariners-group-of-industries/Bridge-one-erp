"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, Calendar, Search, Info } from "lucide-react";
import type { FilterState, EmployeeRosterItem } from "../types";
import type { CalendarAssignMeta } from "../services/calendar-assign.service";

interface CalendarFilterSectionProps {
  filter: FilterState;
  onChange: (patch: Partial<FilterState>) => void;
  onView: () => void;
  onOpenCalendarInfo: () => void;
  employees: EmployeeRosterItem[];
  options: CalendarAssignMeta;
  loading?: boolean;
}

export function CalendarFilterSection({
  filter,
  onChange,
  onView,
  onOpenCalendarInfo,
  employees,
  options,
  loading = false,
}: CalendarFilterSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Available employees from options or current employees list
  const empList = options.employeeOptions?.length ? options.employeeOptions : employees;
  const availableEmployees = empList.filter((emp) => {
    if (filter.office && emp.officeName && emp.officeName !== filter.office) return false;
    if (filter.department && emp.department && emp.department !== filter.department) return false;
    return true;
  });


  return (
    <div className="rounded-md border border-accent-line/60 bg-surface shadow-xs overflow-hidden">
      {/* Tab Header Bar with Collapse Button */}
      <div className="flex items-center justify-between border-b border-accent-line/60 bg-[#edf5fd] dark:bg-[#0f1d36] px-4 py-1.5">
        <div className="flex items-center">
          <div className="relative pb-1">
            <span className="text-xs font-bold text-primary tracking-wide px-2 py-0.5">
              Filter
            </span>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="rounded p-1 text-ink-muted hover:bg-hover hover:text-ink transition-colors"
          aria-label={collapsed ? "Expand filter panel" : "Collapse filter panel"}
        >
          {collapsed ? (
            <ChevronDown className="size-4 text-ink-muted" />
          ) : (
            <ChevronUp className="size-4 text-ink-muted" />
          )}
        </button>
      </div>

      {/* Filter Body */}
      {!collapsed && (
        <div className="p-4 bg-[#f4f8fe]/80 dark:bg-[#0c162c]/50 space-y-3">
          {/* Row 1: Office, Department, Department Section, Designation, Employee, From Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Office */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-ink">Office</label>
              <select
                value={filter.office}
                onChange={(e) => onChange({ office: e.target.value, employeeId: "" })}
                className="w-full h-8 text-xs rounded border border-line-strong bg-surface px-2.5 text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
              >
                <option value="">Select Office</option>
                {options.offices.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Department */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-ink">Department</label>
              <select
                value={filter.department}
                onChange={(e) => onChange({ department: e.target.value, employeeId: "" })}
                className="w-full h-8 text-xs rounded border border-line-strong bg-surface px-2.5 text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
              >
                <option value="">Select Department</option>
                {options.departments.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Department Section */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-ink">Department Section</label>
              <select
                value={filter.departmentSection}
                onChange={(e) => onChange({ departmentSection: e.target.value, employeeId: "" })}
                className="w-full h-8 text-xs rounded border border-line-strong bg-surface px-2.5 text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
              >
                <option value="">Select Department Section</option>
                {options.departmentSections.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Designation */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-ink">Designation</label>
              <select
                value={filter.designation}
                onChange={(e) => onChange({ designation: e.target.value, employeeId: "" })}
                className="w-full h-8 text-xs rounded border border-line-strong bg-surface px-2.5 text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
              >
                <option value="">Select Designation</option>
                {options.designations.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Employee Search / Select */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-ink">Employee</label>
              <select
                value={filter.employeeId}
                onChange={(e) => onChange({ employeeId: e.target.value })}
                className="w-full h-8 text-xs rounded border border-line-strong bg-surface px-2.5 text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
              >
                <option value="">Select/Search employee</option>
                {availableEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.employeeCode} - {emp.name}
                  </option>
                ))}
              </select>
            </div>

            {/* * From Date */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-ink flex items-center gap-1">
                <span className="text-danger font-bold">*</span> From Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={filter.fromDate}
                  onChange={(e) => onChange({ fromDate: e.target.value })}
                  className="w-full h-8 text-xs rounded border border-line-strong bg-surface px-2.5 text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                  required
                />
              </div>
            </div>
          </div>

          {/* Row 2: To Date, isAssignAll checkbox, View button, Calendar Info button */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end pt-1">
            {/* * To Date */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-ink flex items-center gap-1">
                <span className="text-danger font-bold">*</span> To Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={filter.toDate}
                  onChange={(e) => onChange({ toDate: e.target.value })}
                  className="w-full h-8 text-xs rounded border border-line-strong bg-surface px-2.5 text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                  required
                />
              </div>
            </div>

            {/* isAssignAll Checkbox */}
            <div className="flex items-center h-8 gap-2">
              <input
                id="isAssignAll"
                type="checkbox"
                checked={filter.isAssignAll}
                onChange={(e) => onChange({ isAssignAll: e.target.checked })}
                className="size-4 rounded border-line-strong text-primary focus:ring-primary accent-primary cursor-pointer"
              />
              <label
                htmlFor="isAssignAll"
                className="text-xs font-semibold text-ink cursor-pointer select-none"
              >
                isAssignAll
              </label>
            </div>

            {/* Buttons: View & Calendar Info */}
            <div className="flex items-center gap-2 sm:col-span-2">
              <button
                type="button"
                onClick={onView}
                className="inline-flex items-center justify-center h-8 px-5 rounded font-semibold text-xs text-white bg-primary hover:bg-primary-hover shadow-xs transition-colors cursor-pointer"
              >
                View
              </button>
              <button
                type="button"
                onClick={onOpenCalendarInfo}
                className="inline-flex items-center justify-center h-8 px-4 rounded font-semibold text-xs text-white bg-primary hover:bg-primary-hover shadow-xs transition-colors cursor-pointer"
              >
                Calendar Info
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
