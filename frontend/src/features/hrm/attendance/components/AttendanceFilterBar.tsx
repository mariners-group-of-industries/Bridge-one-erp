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

  return (
    <div className="rounded-md border border-accent-line/60 bg-[#f4f8fe]/80 dark:bg-[#0c162c]/50 p-3 shadow-2xs">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 items-end">
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

  /** Employees matching every chosen employee filter, optionally ignoring one (for that filter's own options). */
  const matching = (except?: FilterKey) => employees.filter((e) => EMPLOYEE_FILTERS.every((f) => f.key === except || !chosen(f.key) || e[f.field] === chosen(f.key)));

        {/* Office */}
        <div className="space-y-1">
          <label htmlFor="attendance-office" className="text-[11px] font-semibold text-ink">Office</label>
          <select
            id="attendance-office"
            value={filters.officeId}
            // An employee picked for another office would leave the table empty.
            onChange={(e) => onChange({ officeId: e.target.value, employeeId: "ALL" })}
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

        {/* Employee */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-ink">Employee</label>
          <select
            value={filters.employeeId}
            onChange={(e) => onChange({ employeeId: e.target.value })}
            className="w-full h-8 text-xs rounded border border-line-strong bg-surface px-2.5 text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
          >
            <option value="ALL">All Employees</option>
            {officeEmployees.map((emp) => (
              <option key={emp.id} value={emp.employeeCode}>
                {emp.employeeCode} - {emp.name}
              </option>
            ))}
          </select>
        </div>

  function setEmployeeFilter(key: FilterKey, value: string) {
    const next = { ...filters, [key]: value };
    const stillListed = employees.some((e) => e.employeeCode === filters.employeeId && EMPLOYEE_FILTERS.every((f) => !next[f.key] || next[f.key] === "ALL" || e[f.field] === next[f.key]));
    // A chosen employee outside the new filter would return nothing: go back to all employees.
    onChange({ [key]: value, ...(filters.employeeId !== "ALL" && !stillListed ? { employeeId: "ALL" } : {}) });
  }

  return (
    <form
      role="search"
      aria-label="Attendance filters"
      className="rounded-md border border-accent-line/60 bg-[#f4f8fe]/80 dark:bg-[#0c162c]/50 p-3 shadow-2xs"
      onSubmit={(event) => {
        event.preventDefault();
        onView();
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 items-end">
        <Field label="From Date">{(id) => <input id={id} type="date" value={filters.fromDate} onChange={(e) => onChange({ fromDate: e.target.value })} className={CONTROL} />}</Field>
        <Field label="To Date">{(id) => <input id={id} type="date" value={filters.toDate} onChange={(e) => onChange({ toDate: e.target.value })} className={CONTROL} />}</Field>

        <Field label="View By">
          {(id) => (
            <select id={id} value={filters.viewBy} onChange={(e) => onChange({ viewBy: e.target.value as AttendanceFilterState["viewBy"] })} className={CONTROL}>
              <option value="Employee">Employee</option>
              <option value="Department">Department</option>
              <option value="Date">Date</option>
              <option value="All">All</option>
            </select>
          )}
        </Field>

        {EMPLOYEE_FILTERS.map((f) => (
          <Field key={f.key} label={f.label}>
            {(id) => (
              <select id={id} value={chosen(f.key) || "ALL"} onChange={(e) => setEmployeeFilter(f.key, e.target.value)} className={CONTROL}>
                <option value="ALL">{f.all}</option>
                {options[f.key].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            )}
          </Field>
        ))}

        <Field label={`Employee (${employeeOptions.length})`}>
          {(id) => (
            <select id={id} value={filters.employeeId} onChange={(e) => onChange({ employeeId: e.target.value })} className={CONTROL}>
              <option value="ALL">All Employees</option>
              {employeeOptions.map((emp) => (
                <option key={emp.id} value={emp.employeeCode}>
                  {emp.employeeCode} - {emp.name}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="Status">
          {(id) => (
            <select id={id} value={filters.status} onChange={(e) => onChange({ status: e.target.value })} className={CONTROL}>
              <option value="ALL">All</option>
              <option value="Present">Present</option>
              <option value="Late">Late</option>
              <option value="Absent">Absent</option>
              <option value="Offday">Offday</option>
              <option value="Holiday">Holiday</option>
              <option value="Leave">Leave</option>
            </select>
          )}
        </Field>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            aria-busy={loading || undefined}
            className="inline-flex items-center justify-center flex-1 h-8 px-5 rounded font-semibold text-xs text-white bg-primary hover:bg-primary-hover shadow-xs transition-colors cursor-pointer disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <RefreshCw aria-hidden="true" className="size-3.5 animate-spin" />
                Loading...
              </span>
            ) : (
              "View"
            )}
          </button>
          <button
            type="button"
            disabled={!anyEmployeeFilter || loading}
            onClick={() => onChange({ office: "ALL", department: "ALL", departmentSection: "ALL", designation: "ALL", employeeId: "ALL" })}
            title="Clear employee filters"
            aria-label="Clear employee filters"
            className="inline-flex items-center justify-center size-8 shrink-0 rounded border border-line-strong bg-surface text-ink-muted hover:bg-control hover:text-ink shadow-2xs transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <RotateCcw aria-hidden="true" className="size-3.5" />
          </button>
        </div>
      </div>
    </form>
  );
}
