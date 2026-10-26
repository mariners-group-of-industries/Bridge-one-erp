"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  CalendarDays,
  Save,
  CheckCircle2,
  RefreshCw,
  SlidersHorizontal,
  CalendarCheck,
  FileSpreadsheet,
} from "lucide-react";
import { CalendarFilterSection } from "./CalendarFilterSection";
import { BulkAssignToolbar } from "./BulkAssignToolbar";
import { DynamicCalendarGrid } from "./DynamicCalendarGrid";
import { CalendarInfoModal } from "./CalendarInfoModal";
import { useToast } from "@/components/ui/toast";
import {
  CALENDAR_DEFINITIONS,
  CALENDAR_CODE_MAP,
} from "../constants";
import type {
  FilterState,
  EmployeeRosterItem,
  RosterGridData,
} from "../types";
import type { CalendarAssignMeta } from "../services/calendar-assign.service";

const STORAGE_KEY = "bridgeone_dynamic_calendar_assignments_v1";

interface DynamicCalendarViewProps {
  initialEmployees: EmployeeRosterItem[];
  initialOptions: CalendarAssignMeta;
}

export function DynamicCalendarView({
  initialEmployees,
  initialOptions,
}: DynamicCalendarViewProps) {
  const toast = useToast();

  // Real Employees & Options loaded from database
  const [employees, setEmployees] = useState<EmployeeRosterItem[]>(initialEmployees);
  const [options, setOptions] = useState<CalendarAssignMeta>(initialOptions);
  const [isLoading, setIsLoading] = useState(false);

  // Scroll Pagination State
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(initialEmployees.length);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasFiltered, setHasFiltered] = useState(initialEmployees.length > 0);

  // Filters State (default dates match user screenshot: 01/10/2026 to 31/10/2026)
  const [filter, setFilter] = useState<FilterState>({
    office: "",
    department: "",
    departmentSection: "",
    designation: "",
    employeeId: "",
    fromDate: "2026-10-01",
    toDate: "2026-10-31",
    isAssignAll: false,
  });

  // Modal State
  const [calendarInfoOpen, setCalendarInfoOpen] = useState(false);

  // Selected Shift in Bulk Toolbar
  const [selectedShiftForBulk, setSelectedShiftForBulk] = useState<string>("G");

  // Selected row IDs in matrix grid
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());

  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(0);

  // Helper to generate default shift based on office
  const getDefaultShiftForOffice = (officeName: string): string => {
    if (officeName.includes("Factory")) return "g"; // General-g for factory
    if (officeName.toLowerCase().includes("marinozz")) return "R-G"; // Restaurant-G
    return "G"; // Dhaka Head Office General-G
  };

  // Generate Date Range info
  const dates = useMemo(() => {
    const list: {
      dateStr: string;
      dayNum: number;
      dayName: string;
      isWeekend: boolean;
    }[] = [];

    if (!filter.fromDate || !filter.toDate) return list;

    const start = new Date(filter.fromDate);
    const end = new Date(filter.toDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return list;
    }

    const current = new Date(start);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    while (current <= end) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, "0");
      const day = String(current.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;
      const dayOfWeek = current.getDay();

      list.push({
        dateStr,
        dayNum: current.getDate(),
        dayName: dayNames[dayOfWeek],
        isWeekend: dayOfWeek === 5, // Friday in Bangladesh
      });

      current.setDate(current.getDate() + 1);
    }

    return list;
  }, [filter.fromDate, filter.toDate]);

  // Client-side quick filtering of currently loaded real employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (filter.office && emp.officeName !== filter.office) return false;
      if (filter.department && emp.department !== filter.department) return false;
      if (filter.departmentSection && emp.departmentSection !== filter.departmentSection) return false;
      if (filter.designation && emp.designation !== filter.designation) return false;
      if (filter.employeeId && emp.id !== filter.employeeId) return false;
      return true;
    });
  }, [employees, filter]);

  // Grid Data State
  const [gridData, setGridData] = useState<RosterGridData>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          return JSON.parse(saved);
        }
      } catch (e) {
        console.error("Failed to read from localStorage", e);
      }
    }
    return {};
  });

  // Handle Fetch / Filter on View button click from DB
  const handleView = async () => {
    setIsLoading(true);
    setPage(1);
    try {
      const searchParams = new URLSearchParams();
      if (filter.office) searchParams.set("office", filter.office);
      if (filter.department) searchParams.set("department", filter.department);
      if (filter.departmentSection) searchParams.set("departmentSection", filter.departmentSection);
      if (filter.designation) searchParams.set("designation", filter.designation);
      if (filter.employeeId) searchParams.set("employeeId", filter.employeeId);
      searchParams.set("page", "1");
      searchParams.set("limit", "40");

      const res = await fetch(`/api/hrm/calendar-assign?${searchParams.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.employees)) {
        setEmployees(data.employees);
        setHasMore(Boolean(data.pagination?.hasMore));
        setTotalCount(data.pagination?.total || data.employees.length);
        setHasFiltered(true);
        if (data.options) {
          setOptions(data.options);
        }
        if (data.employees.length > 0) {
          toast.success(
            `Displaying ${data.employees.length} of ${data.pagination?.total || data.employees.length} employees.`,
          );
        } else {
          toast.info("No employees found matching the selected filters.");
        }
      } else {
        toast.error(data.error || "Failed to load employees from database");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load employees from database.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle scroll pagination load more
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore || isLoading) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    try {
      const searchParams = new URLSearchParams();
      if (filter.office) searchParams.set("office", filter.office);
      if (filter.department) searchParams.set("department", filter.department);
      if (filter.departmentSection) searchParams.set("departmentSection", filter.departmentSection);
      if (filter.designation) searchParams.set("designation", filter.designation);
      if (filter.employeeId) searchParams.set("employeeId", filter.employeeId);
      searchParams.set("page", String(nextPage));
      searchParams.set("limit", "40");

      const res = await fetch(`/api/hrm/calendar-assign?${searchParams.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.employees)) {
        setEmployees((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const newOnes = data.employees.filter((e: any) => !existingIds.has(e.id));
          return [...prev, ...newOnes];
        });
        setPage(nextPage);
        setHasMore(Boolean(data.pagination?.hasMore));
        setTotalCount(data.pagination?.total || 0);
      }
    } catch (err) {
      console.error("Failed to load more employees", err);
    } finally {
      setIsLoadingMore(false);
    }
  };


  // Handle cell change
  const handleCellChange = (employeeId: string, dateStr: string, newShiftCode: string) => {
    setGridData((prev) => ({
      ...prev,
      [employeeId]: {
        ...(prev[employeeId] || {}),
        [dateStr]: newShiftCode,
      },
    }));
    setUnsavedChanges((c) => c + 1);
  };

  // Bulk Apply Shift to real employees
  const handleBulkApply = (
    shiftCode: string,
    mode: "all" | "working_days" | "selected_only",
  ) => {
    const targetEmployees =
      filter.isAssignAll || selectedEmployeeIds.size === 0
        ? filteredEmployees
        : filteredEmployees.filter((e) => selectedEmployeeIds.has(e.id));

    if (targetEmployees.length === 0) {
      toast.error("No employees to assign.");
      return;
    }

    setGridData((prev) => {
      const next = { ...prev };
      targetEmployees.forEach((emp) => {
        next[emp.id] = { ...(next[emp.id] || {}) };
        dates.forEach((d) => {
          if (mode === "working_days" && d.isWeekend) {
            return;
          }
          next[emp.id][d.dateStr] = shiftCode;
        });
      });
      return next;
    });

    setUnsavedChanges((c) => c + 1);
    toast.success(
      `Assigned shift [${shiftCode}] to ${targetEmployees.length} employees successfully.`,
    );
  };

  // Column Bulk Assign (single date to all filtered employees)
  const handleColumnBulkAssign = (dateStr: string, shiftCode: string) => {
    setGridData((prev) => {
      const next = { ...prev };
      filteredEmployees.forEach((emp) => {
        next[emp.id] = {
          ...(next[emp.id] || {}),
          [dateStr]: shiftCode,
        };
      });
      return next;
    });
    setUnsavedChanges((c) => c + 1);
    toast.success(`Assigned shift [${shiftCode}] for ${dateStr} across ${filteredEmployees.length} employees.`);
  };

  // Set Weekly Offs (e.g. Fridays)
  const handleSetWeeklyOffs = (dayOfWeek: number) => {
    setGridData((prev) => {
      const next = { ...prev };
      filteredEmployees.forEach((emp) => {
        next[emp.id] = { ...(next[emp.id] || {}) };
        dates.forEach((d) => {
          const dateObj = new Date(d.dateStr);
          if (dateObj.getDay() === dayOfWeek) {
            next[emp.id][d.dateStr] = "OFF";
          }
        });
      });
      return next;
    });
    setUnsavedChanges((c) => c + 1);
    toast.success("Fridays updated to Weekly Off (OFF).");
  };

  // Reset defaults
  const handleResetDefaults = () => {
    setGridData((prev) => {
      const next = { ...prev };
      filteredEmployees.forEach((emp) => {
        const defaultShift = getDefaultShiftForOffice(emp.officeName);
        next[emp.id] = {};
        dates.forEach((d) => {
          next[emp.id][d.dateStr] = d.isWeekend ? "OFF" : defaultShift;
        });
      });
      return next;
    });
    setUnsavedChanges((c) => c + 1);
    toast.success("Roster reset to default shift assignments.");
  };

  // Row selection
  const handleToggleSelectAll = () => {
    const allSelected =
      filteredEmployees.length > 0 &&
      filteredEmployees.every((e) => selectedEmployeeIds.has(e.id));

    if (allSelected) {
      setSelectedEmployeeIds(new Set());
    } else {
      setSelectedEmployeeIds(new Set(filteredEmployees.map((e) => e.id)));
    }
  };

  const handleToggleSelectEmployee = (id: string) => {
    setSelectedEmployeeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Save changes
  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(gridData));
      }

      await fetch("/api/hrm/calendar-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignments: gridData,
          employeeCount: filteredEmployees.length,
          savedAt: new Date().toISOString(),
        }),
      });

      setUnsavedChanges(0);
      toast.success(
        `Dynamic calendar assigned and saved successfully for ${filteredEmployees.length} employees!`,
      );
    } catch (e) {
      toast.error("Failed to save calendar assignments.");
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Top Header Card matching user screenshot: "Dynamic Calendar" on left, "Save" on right */}
      <div className="sticky top-14 z-20 -mx-4 -mt-2 bg-canvas/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarCheck className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-ink">Dynamic Calendar</h1>
                {hasFiltered ? (
                  <span className="text-[11px] font-medium bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5">
                    {filteredEmployees.length}
                    {totalCount > filteredEmployees.length ? ` of ${totalCount}` : ""}{" "}
                    Employees
                  </span>
                ) : (
                  <span className="text-[11px] font-medium bg-canvas text-ink-muted border border-line rounded-full px-2 py-0.5">
                    Filter Required
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-muted">
                Shift roster allocation and dynamic calendar assignment for employees
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {unsavedChanges > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-full px-2.5 py-0.5">
                ● {unsavedChanges} pending changes
              </span>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || filteredEmployees.length === 0}
              className="inline-flex items-center justify-center h-8 px-6 rounded font-semibold text-xs text-white bg-primary hover:bg-primary-hover active:bg-primary-hover shadow-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="size-3.5 animate-spin" />
                  Saving...
                </span>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Filter Section matching user screenshot */}
      <CalendarFilterSection
        filter={filter}
        onChange={(patch) => setFilter((prev) => ({ ...prev, ...patch }))}
        onView={handleView}
        onOpenCalendarInfo={() => setCalendarInfoOpen(true)}
        employees={employees}
        options={options}
        loading={isLoading}
      />

      {/* When no filter has been executed, show the Company Logo state */}
      {!hasFiltered && employees.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-8 sm:p-14 text-center shadow-xs">
          <div className="max-w-xl mx-auto space-y-6">
            {/* Company Logo */}
            <div className="flex justify-center">
              <img
                src="/logo.png"
                alt="BridgeOne ERP"
                className="h-14 sm:h-16 w-auto object-contain drop-shadow-xs"
              />
            </div>

            <div className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-ink">
                Dynamic Calendar Schedule Assignment
              </h2>
              <p className="text-xs text-ink-muted leading-relaxed max-w-lg mx-auto">
                Filter by <strong>Office</strong>, <strong>Department</strong>, <strong>Section</strong>, or <strong>Employee</strong> in the filter bar above, then click <span className="font-semibold text-primary">View</span> to load and configure shift rosters.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={handleView}
                disabled={isLoading}
                className="inline-flex items-center gap-2 h-8 px-5 rounded-md text-xs font-semibold text-white bg-primary hover:bg-primary-hover shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    Loading Employees...
                  </>
                ) : (
                  <>
                    <CalendarCheck className="size-3.5" />
                    Load All Employees
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setCalendarInfoOpen(true)}
                className="inline-flex items-center gap-1.5 h-8 px-4 rounded-md text-xs font-semibold text-ink bg-canvas hover:bg-hover border border-line transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="size-3.5 text-primary" />
                Calendar Shift Legend
              </button>
            </div>

            {/* Official Shifts Summary */}
            <div className="pt-5 border-t border-line/60">
              <div className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-2.5">
                Official Shift Calendars
              </div>
              <div className="flex flex-wrap justify-center gap-1.5">
                {CALENDAR_DEFINITIONS.map((c) => (
                  <span
                    key={c.shortCode}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-medium ${c.badgeBg} ${c.badgeText} ${c.badgeBorder}`}
                  >
                    <strong className="font-bold">{c.shortCode}</strong>
                    <span>{c.calendarName}</span>
                    {c.startTime !== "-" && (
                      <span className="opacity-70 text-[10px]">({c.startTime})</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : hasFiltered && employees.length === 0 ? (
        /* Empty results state */
        <div className="rounded-xl border border-line bg-surface p-12 text-center shadow-xs">
          <div className="max-w-md mx-auto space-y-3">
            <CalendarCheck className="size-8 text-ink-faint mx-auto" />
            <h3 className="text-sm font-semibold text-ink">No Employees Found</h3>
            <p className="text-xs text-ink-muted">
              No active employees matched the selected filters. Try choosing a different office or department.
            </p>
            <button
              type="button"
              onClick={() => {
                setFilter((prev) => ({
                  ...prev,
                  office: "",
                  department: "",
                  departmentSection: "",
                  designation: "",
                  employeeId: "",
                }));
                handleView();
              }}
              className="inline-flex items-center gap-1.5 h-8 px-4 rounded-md text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
            >
              Reset Filters & View All
            </button>
          </div>
        </div>
      ) : (
        /* Filtered Calendar Matrix with Scroll Pagination */
        <>
          {/* Bulk Assignment & Quick Tools Bar */}
          <BulkAssignToolbar
            selectedShift={selectedShiftForBulk}
            onSelectShift={setSelectedShiftForBulk}
            onApplyToAll={handleBulkApply}
            onSetWeeklyOffs={handleSetWeeklyOffs}
            onResetAll={handleResetDefaults}
            selectedCount={selectedEmployeeIds.size}
            totalFilteredCount={filteredEmployees.length}
            isAssignAll={filter.isAssignAll}
          />

          {/* Dynamic Calendar Matrix Grid */}
          <DynamicCalendarGrid
            employees={filteredEmployees}
            dates={dates}
            gridData={gridData}
            onCellChange={handleCellChange}
            onColumnBulkAssign={handleColumnBulkAssign}
            selectedEmployeeIds={selectedEmployeeIds}
            onToggleSelectAll={handleToggleSelectAll}
            onToggleSelectEmployee={handleToggleSelectEmployee}
            onLoadMore={handleLoadMore}
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
            totalCount={totalCount}
          />
        </>
      )}

      {/* Calendar Info Modal Dialog */}
      <CalendarInfoModal
        open={calendarInfoOpen}
        onClose={() => setCalendarInfoOpen(false)}
        defaultOffice={filter.office || "ALL"}
      />
    </div>
  );
}

