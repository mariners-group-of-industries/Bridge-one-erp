"use client";

import { useState, useRef, useEffect } from "react";
import {
  CalendarDays,
  Clock,
  ChevronDown,
  Info,
  Check,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import type { EmployeeRosterItem, RosterGridData, CalendarDefinition } from "../types";
import { CALENDAR_DEFINITIONS, CALENDAR_CODE_MAP } from "../constants";

interface DateInfo {
  dateStr: string; // YYYY-MM-DD
  dayNum: number;
  dayName: string; // Mon, Tue, etc.
  isWeekend: boolean; // Friday in BD
}

interface DynamicCalendarGridProps {
  employees: EmployeeRosterItem[];
  dates: DateInfo[];
  gridData: RosterGridData;
  onCellChange: (employeeId: string, dateStr: string, newShiftCode: string) => void;
  onColumnBulkAssign: (dateStr: string, shiftCode: string) => void;
  selectedEmployeeIds: Set<string>;
  onToggleSelectAll: () => void;
  onToggleSelectEmployee: (id: string) => void;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  totalCount?: number;
}

export function DynamicCalendarGrid({
  employees,
  dates,
  gridData,
  onCellChange,
  onColumnBulkAssign,
  selectedEmployeeIds,
  onToggleSelectAll,
  onToggleSelectEmployee,
  onLoadMore,
  isLoadingMore = false,
  hasMore = false,
  totalCount,
}: DynamicCalendarGridProps) {
  // Active cell popover state
  const [activeCell, setActiveCell] = useState<{
    employeeId: string;

    dateStr: string;
  } | null>(null);

  // Column header popover state
  const [activeColMenu, setActiveColMenu] = useState<string | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setActiveCell(null);
        setActiveColMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const allSelected =
    employees.length > 0 && employees.every((e) => selectedEmployeeIds.has(e.id));
  const someSelected =
    employees.some((e) => selectedEmployeeIds.has(e.id)) && !allSelected;

  return (
    <div className="space-y-3">
      {/* Shift Legend Chips */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface p-2.5 text-xs">
        <span className="font-semibold text-ink flex items-center gap-1.5 pr-2 border-r border-line">
          <Info className="size-3.5 text-primary" /> Shift Legend:
        </span>
        {CALENDAR_DEFINITIONS.map((c) => (
          <div
            key={c.shortCode}
            className="flex items-center gap-1.5 rounded-full border border-line bg-canvas px-2.5 py-0.5"
            title={`${c.calendarName} (${c.startTime} - ${c.endTime}) - Office: ${c.office}`}
          >
            <span
              className={`inline-flex items-center justify-center size-5 rounded text-[10px] font-bold border ${c.badgeBg} ${c.badgeText} ${c.badgeBorder}`}
            >
              {c.shortCode}
            </span>
            <span className="text-[11px] font-medium text-ink">{c.calendarName}</span>
            {c.startTime !== "-" && (
              <span className="text-[10px] text-ink-faint">
                ({c.startTime.replace(" AM", "a").replace(" PM", "p")} - {c.endTime.replace(" AM", "a").replace(" PM", "p")})
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Matrix Table with sticky headers and sticky left columns */}
      <div
        onScroll={(e) => {
          if (!hasMore || isLoadingMore || !onLoadMore) return;
          const el = e.currentTarget;
          if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
            onLoadMore();
          }
        }}
        className="relative overflow-x-auto rounded-md border border-grid-line bg-surface shadow-xs max-h-[600px] overflow-y-auto"
      >
        <table className="w-full text-left border-collapse text-xs">

          <thead className="sticky top-0 z-30 bg-grid-head text-grid-head-ink border-b-2 border-grid-head-rule shadow-xs">
            <tr>
              {/* Checkbox column */}
              <th className="sticky left-0 z-40 bg-grid-head px-2.5 py-2.5 w-10 text-center border-r border-grid-line">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={onToggleSelectAll}
                  className="size-3.5 rounded border-grid-line text-primary focus:ring-primary accent-primary cursor-pointer"
                  title="Select All Employees"
                />
              </th>

              {/* SL # */}
              <th className="sticky left-10 z-40 bg-grid-head px-2 py-2.5 w-12 text-center font-bold border-r border-grid-line">
                SL
              </th>

              {/* Employee ID */}
              <th className="sticky left-22 z-40 bg-grid-head px-3 py-2.5 min-w-[110px] font-bold border-r border-grid-line">
                Emp. Code
              </th>

              {/* Employee Name */}
              <th className="sticky left-[198px] z-40 bg-grid-head px-3 py-2.5 min-w-[190px] font-bold border-r border-grid-line">
                Employee Name
              </th>

              {/* Designation & Office */}
              <th className="sticky left-[388px] z-40 bg-grid-head px-3 py-2.5 min-w-[200px] font-bold border-r-2 border-primary/40 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                Office & Designation
              </th>

              {/* Dynamic Date Columns */}
              {dates.map((date) => (
                <th
                  key={date.dateStr}
                  className={`relative px-1.5 py-2 text-center min-w-[42px] border-r border-grid-line select-none ${
                    date.isWeekend
                      ? "bg-red-50/90 text-red-700 dark:bg-red-950/40 dark:text-red-300 font-bold"
                      : "bg-grid-head text-grid-head-ink font-semibold"
                  }`}
                >
                  <div className="flex flex-col items-center justify-center leading-tight">
                    <span className="text-[10px] uppercase font-bold tracking-tight">
                      {date.dayName}
                    </span>
                    <span className="text-xs font-extrabold">{date.dayNum}</span>
                  </div>

                  {/* Quick bulk button on column header */}
                  <button
                    type="button"
                    onClick={() =>
                      setActiveColMenu(activeColMenu === date.dateStr ? null : date.dateStr)
                    }
                    className="absolute top-1 right-0.5 opacity-40 hover:opacity-100 hover:text-primary transition-opacity"
                    title={`Bulk assign for ${date.dateStr}`}
                  >
                    <ChevronDown className="size-2.5" />
                  </button>

                  {/* Column Header Dropdown Menu */}
                  {activeColMenu === date.dateStr && (
                    <div
                      ref={popoverRef}
                      className="absolute left-1/2 top-full -translate-x-1/2 mt-1 z-50 w-44 rounded-md border border-line bg-surface p-1.5 shadow-xl text-left"
                    >
                      <div className="px-2 py-1 text-[10px] font-bold text-ink-muted border-b border-line mb-1">
                        Assign {date.dateStr} to all:
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-0.5">
                        {CALENDAR_DEFINITIONS.map((c) => (
                          <button
                            key={c.shortCode}
                            type="button"
                            onClick={() => {
                              onColumnBulkAssign(date.dateStr, c.shortCode);
                              setActiveColMenu(null);
                            }}
                            className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs text-ink hover:bg-hover"
                          >
                            <span
                              className={`size-4 rounded text-[9px] font-bold flex items-center justify-center border ${c.badgeBg} ${c.badgeText} ${c.badgeBorder}`}
                            >
                              {c.shortCode}
                            </span>
                            <span className="truncate">{c.calendarName}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </th>
              ))}

              {/* Summary Columns */}
              <th className="px-2.5 py-2.5 text-center min-w-[50px] font-bold bg-grid-head border-r border-grid-line">
                Work
              </th>
              <th className="px-2.5 py-2.5 text-center min-w-[50px] font-bold bg-grid-head">
                Off
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-grid-line">
            {employees.length === 0 ? (
              <tr>
                <td
                  colSpan={dates.length + 7}
                  className="py-12 text-center text-ink-muted text-sm font-medium"
                >
                  No employees found matching the filter criteria.
                </td>
              </tr>
            ) : (
              employees.map((emp, index) => {
                const empGrid = gridData[emp.id] || {};
                const isSelected = selectedEmployeeIds.has(emp.id);

                // Calculate summary for this employee
                let workCount = 0;
                let offCount = 0;
                dates.forEach((d) => {
                  const code = empGrid[d.dateStr];
                  if (code === "OFF" || code === "HOL") {
                    offCount++;
                  } else if (code) {
                    workCount++;
                  }
                });

                return (
                  <tr
                    key={emp.id}
                    className={`transition-colors hover:bg-grid-hover ${
                      isSelected ? "bg-accent-soft/40" : ""
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="sticky left-0 z-20 bg-surface px-2.5 py-2 text-center border-r border-grid-line">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelectEmployee(emp.id)}
                        className="size-3.5 rounded border-grid-line text-primary focus:ring-primary accent-primary cursor-pointer"
                      />
                    </td>

                    {/* SL # */}
                    <td className="sticky left-10 z-20 bg-surface px-2 py-2 text-center text-ink-muted font-mono text-[11px] border-r border-grid-line">
                      {index + 1}
                    </td>

                    {/* Employee Code & Attendance ID */}
                    <td className="sticky left-22 z-20 bg-surface px-3 py-2 border-r border-grid-line whitespace-nowrap">
                      <div className="font-semibold text-ink font-mono text-[11px]">
                        {emp.employeeCode}
                      </div>
                      <div className="text-[10px] text-ink-faint font-mono">
                        {emp.attendanceId}
                      </div>
                    </td>

                    {/* Employee Name */}
                    <td className="sticky left-[198px] z-20 bg-surface px-3 py-2 border-r border-grid-line whitespace-nowrap">
                      <div className="font-semibold text-ink truncate max-w-[170px]" title={emp.name}>
                        {emp.name}
                      </div>
                      <div className="text-[10px] text-ink-faint truncate max-w-[170px]">
                        {emp.department}
                      </div>
                    </td>

                    {/* Office & Designation */}
                    <td className="sticky left-[388px] z-20 bg-surface px-3 py-2 border-r-2 border-primary/40 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.06)] whitespace-nowrap">
                      <div className="font-medium text-ink truncate max-w-[180px]">
                        {emp.designation}
                      </div>
                      <div className="text-[10px] text-ink-muted truncate max-w-[180px]">
                        {emp.officeName}
                      </div>
                    </td>

                    {/* Date Shift Cells */}
                    {dates.map((date) => {
                      const code = empGrid[date.dateStr] || "";
                      const cal = code ? CALENDAR_CODE_MAP.get(code) : undefined;
                      const isCellActive =
                        activeCell?.employeeId === emp.id &&
                        activeCell?.dateStr === date.dateStr;

                      return (
                        <td
                          key={date.dateStr}
                          className={`relative p-0 text-center border-r border-grid-line select-none ${
                            date.isWeekend
                              ? "bg-red-50/40 dark:bg-red-950/20"
                              : ""
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setActiveCell(
                                isCellActive
                                  ? null
                                  : { employeeId: emp.id, dateStr: date.dateStr },
                              )
                            }
                            className="w-full h-9 flex items-center justify-center font-bold text-xs transition-all hover:bg-hover/80 hover:z-10 focus:z-10 focus:outline-none"
                            title={
                              code
                                ? `${emp.name} on ${date.dateStr}: ${
                                    cal ? `${cal.calendarName} (${cal.startTime} - ${cal.endTime})` : code
                                  }`
                                : `${emp.name} on ${date.dateStr}: Unassigned`
                            }
                          >
                            {code ? (
                              <span
                                className={`inline-flex items-center justify-center min-w-[26px] h-6 px-1 rounded text-[11px] font-extrabold border shadow-2xs ${
                                  cal
                                    ? `${cal.badgeBg} ${cal.badgeText} ${cal.badgeBorder}`
                                    : "bg-control text-ink border-line"
                                }`}
                              >
                                {code}
                              </span>
                            ) : (
                              <span className="text-ink-faint text-xs font-normal hover:text-ink">
                                —
                              </span>
                            )}
                          </button>

                          {/* Cell Quick Shift Picker Popover */}
                          {isCellActive && (
                            <div
                              ref={popoverRef}
                              className="absolute left-1/2 top-full -translate-x-1/2 mt-1 z-50 w-52 rounded-lg border border-line bg-surface p-2 shadow-2xl text-left"
                            >
                              <div className="flex items-center justify-between border-b border-line pb-1.5 mb-1.5">
                                <span className="text-[10px] font-bold text-ink">
                                  {date.dateStr}
                                </span>
                                <span className="text-[9px] text-ink-muted">
                                  Pick Shift:
                                </span>
                              </div>

                              <div className="grid grid-cols-3 gap-1 mb-2">
                                {CALENDAR_DEFINITIONS.map((c) => (
                                  <button
                                    key={c.shortCode}
                                    type="button"
                                    onClick={() => {
                                      onCellChange(emp.id, date.dateStr, c.shortCode);
                                      setActiveCell(null);
                                    }}
                                    className={`flex flex-col items-center justify-center py-1 rounded border text-center transition-all ${
                                      code === c.shortCode
                                        ? "ring-2 ring-primary ring-offset-1 font-bold"
                                        : "hover:bg-hover"
                                    } ${c.badgeBg} ${c.badgeText} ${c.badgeBorder}`}
                                    title={c.calendarName}
                                  >
                                    <span className="text-xs font-extrabold">{c.shortCode}</span>
                                    <span className="text-[8px] truncate max-w-[48px]">
                                      {c.calendarName}
                                    </span>
                                  </button>
                                ))}
                              </div>

                              {cal && cal.startTime !== "-" && (
                                <div className="text-[9px] text-ink-faint bg-canvas p-1.5 rounded border border-line/60">
                                  <div>
                                    Time: <strong className="text-ink">{cal.startTime} - {cal.endTime}</strong>
                                  </div>
                                  <div>
                                    Grace: <strong className="text-ink">{cal.graceTime}</strong> | Break: <strong className="text-ink">{cal.breakStartTime}-{cal.breakEndTime}</strong>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {/* Summary Work Days */}
                    <td className="px-2 py-2 text-center font-bold text-primary border-r border-grid-line bg-surface font-mono text-[11px]">
                      {workCount}
                    </td>

                    {/* Summary Off Days */}
                    <td className="px-2 py-2 text-center font-bold text-danger bg-surface font-mono text-[11px]">
                      {offCount}
                    </td>
                  </tr>
                );
              })
            )}

            {/* Scroll Pagination Status Row */}
            {isLoadingMore && (
              <tr>
                <td
                  colSpan={dates.length + 8}
                  className="py-3 text-center bg-canvas border-t border-grid-line text-xs font-semibold text-primary"
                >
                  <div className="inline-flex items-center gap-2">
                    <RefreshCw className="size-3.5 animate-spin text-primary" />
                    <span>Loading more employees...</span>
                  </div>
                </td>
              </tr>
            )}

            {!isLoadingMore && hasMore && (
              <tr>
                <td
                  colSpan={dates.length + 8}
                  className="py-2.5 text-center bg-canvas/60 border-t border-grid-line"
                >
                  <button
                    type="button"
                    onClick={onLoadMore}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-primary transition-colors cursor-pointer py-1 px-3 rounded hover:bg-hover"
                  >
                    <span>Scroll or click to load more employees</span>
                    <ChevronDown className="size-3.5" />
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Scroll Pagination Footer Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-md border border-line bg-canvas text-xs text-ink-muted">
        <div className="flex items-center gap-2">
          <span>
            Loaded <strong>{employees.length}</strong>
            {totalCount !== undefined ? ` of ${totalCount}` : ""} employees
          </span>
          {hasMore && (
            <span className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              Scroll down table to load more
            </span>
          )}
          {!hasMore && employees.length > 0 && (
            <span className="text-[11px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full font-medium">
              All {employees.length} employees loaded
            </span>
          )}
        </div>

        {hasMore && (
          <button
            type="button"
            disabled={isLoadingMore}
            onClick={onLoadMore}
            className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline cursor-pointer disabled:opacity-50"
          >
            {isLoadingMore ? (
              <>
                <RefreshCw className="size-3 animate-spin" />
                <span>Loading next chunk...</span>
              </>
            ) : (
              <>
                <span>Load Next Chunk</span>
                <ChevronDown className="size-3" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

