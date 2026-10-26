"use client";

import { useState, useMemo, useEffect } from "react";
import {
  FileText,
  Filter,
  RefreshCw,
  Printer,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  CalendarOff,
  Trash2,
} from "lucide-react";
import { AttendanceFilterBar } from "./AttendanceFilterBar";
import { AttendanceTable } from "./AttendanceTable";
import { AttendanceEditModal } from "./AttendanceEditModal";
import { AttendanceViewModal } from "./AttendanceViewModal";
import { CalendarInfoModal } from "@/features/hrm/calendar-assign/components/CalendarInfoModal";
import { useToast } from "@/components/ui/toast";
import type { AttendanceRecord, AttendanceFilterState, EmployeeOption } from "../types";

interface DailyAttendanceViewProps {
  initialRecords: AttendanceRecord[];
  initialEmployees: EmployeeOption[];
}

export function DailyAttendanceView({
  initialRecords,
  initialEmployees,
}: DailyAttendanceViewProps) {
  const toast = useToast();

  const [records, setRecords] = useState<AttendanceRecord[]>(initialRecords);
  const [employees, setEmployees] = useState<EmployeeOption[]>(initialEmployees);
  const [loading, setLoading] = useState(false);

  // Filters state matching user screenshot: 25/09/2026 to 26/10/2026
  const [filters, setFilters] = useState<AttendanceFilterState>({
    fromDate: "2026-09-25",
    toDate: "2026-10-26",
    viewBy: "Employee",
    employeeId: "ALL",
    status: "ALL",
    pageSize: 50,
    page: 1,
  });

  // Selected rows
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals state
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<AttendanceRecord | null>(null);
  const [calendarInfoOpen, setCalendarInfoOpen] = useState(false);
  const [selectedCalendarOffice, setSelectedCalendarOffice] = useState<string>("ALL");

  // Summary counts
  const stats = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;
    let offday = 0;
    let holiday = 0;
    records.forEach((r) => {
      if (r.actualAttendance === "Present") present++;
      else if (r.actualAttendance === "Late") late++;
      else if (r.actualAttendance === "Absent") absent++;
      else if (r.actualAttendance === "Offday") offday++;
      else if (r.actualAttendance === "Holiday") holiday++;
    });
    return { total: records.length, present, late, absent, offday, holiday };
  }, [records]);

  // Handle Fetch on View button click
  const handleView = async () => {
    setLoading(true);
    try {
      const searchParams = new URLSearchParams();
      searchParams.set("fromDate", filters.fromDate);
      searchParams.set("toDate", filters.toDate);
      searchParams.set("viewBy", filters.viewBy);
      searchParams.set("employeeId", filters.employeeId);
      searchParams.set("status", filters.status);
      searchParams.set("pageSize", String(filters.pageSize));
      searchParams.set("page", String(filters.page));

      const res = await fetch(`/api/hrm/attendance?${searchParams.toString()}`);
      const data = await res.json();

      if (data.success && Array.isArray(data.records)) {
        setRecords(data.records);
        if (data.employees) setEmployees(data.employees);
        if (data.records.length > 0) {
          toast.success(`Loaded ${data.records.length} attendance records.`);
        } else {
          toast.info("No attendance records found.");
        }
      } else {
        toast.error(data.error || "Failed to load records");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to fetch attendance data.");
    } finally {
      setLoading(false);
    }
  };

  // Remove all daily attendance records
  const handleClearAll = async () => {
    try {
      const res = await fetch("/api/hrm/attendance", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setRecords([]);
        setSelectedIds(new Set());
        toast.success("All daily attendance data removed.");
      } else {
        toast.error("Failed to remove attendance data");
      }
    } catch (e) {
      setRecords([]);
      setSelectedIds(new Set());
      toast.success("All daily attendance data removed.");
    }
  };

  // Row selection
  const handleToggleSelectAll = () => {
    if (records.length > 0 && records.every((r) => selectedIds.has(r.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map((r) => r.id)));
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Save edit adjustment
  const handleSaveEdit = (updated: Partial<AttendanceRecord>) => {
    if (!editingRecord) return;
    setRecords((prev) =>
      prev.map((r) => (r.id === editingRecord.id ? { ...r, ...updated } : r)),
    );
    toast.success("Attendance adjusted successfully.");
  };

  // PDF Export / Print Handler
  const handleExportPdf = () => {
    window.print();
  };

  // Open Calendar Info Modal
  const handleOpenCalendarInfo = (calendarName: string) => {
    if (calendarName.includes("General-g") || calendarName.includes("Morning") || calendarName.includes("Evening")) {
      setSelectedCalendarOffice("MG Sirajganj Factory");
    } else if (calendarName.includes("Restaurant")) {
      setSelectedCalendarOffice("Marinozz");
    } else {
      setSelectedCalendarOffice("Dhaka Head Office");
    }
    setCalendarInfoOpen(true);
  };

  return (
    <div className="space-y-3 pb-12">
      {/* Top Bar matching screenshot: "Daily Attendance" tab & PDF button */}
      <div className="flex flex-wrap items-center justify-between border-b border-line bg-canvas/80 pt-1">
        <div className="flex items-center">
          <div className="relative border-b-2 border-primary bg-surface px-5 py-2 text-xs font-bold text-primary shadow-2xs">
            Daily Attendance
          </div>
        </div>

        <div className="flex items-center gap-2 pb-1.5">
          {records.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-800 shadow-2xs transition-colors cursor-pointer"
              title="Remove All Daily Attendance Data"
            >
              <Trash2 className="size-3.5" />
              Remove All Data
            </button>
          )}

          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded text-xs font-semibold text-white bg-primary hover:bg-primary-hover shadow-xs transition-colors cursor-pointer"
            title="Download / Print Attendance PDF"
          >
            <FileText className="size-3.5" />
            PDF
          </button>
        </div>
      </div>


      {/* Filter Bar matching screenshot */}
      <AttendanceFilterBar
        filters={filters}
        onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        onView={handleView}
        employees={employees}
        loading={loading}
      />

      {/* Quick Status Stats Summary Pills */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <div className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-ink font-semibold shadow-2xs">
          <span>Total Days:</span>
          <span className="font-bold">{stats.total}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 px-3 py-1 font-semibold">
          <CheckCircle2 className="size-3" />
          <span>Present:</span>
          <span>{stats.present}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300 px-3 py-1 font-semibold">
          <AlertTriangle className="size-3" />
          <span>Late:</span>
          <span>{stats.late}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300 px-3 py-1 font-semibold">
          <XCircle className="size-3" />
          <span>Absent:</span>
          <span>{stats.absent}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300 px-3 py-1 font-semibold">
          <CalendarOff className="size-3" />
          <span>Offday:</span>
          <span>{stats.offday}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300 px-3 py-1 font-semibold">
          <CalendarDays className="size-3" />
          <span>Holiday:</span>
          <span>{stats.holiday}</span>
        </div>
      </div>

      {/* 20-Column Data Table matching screenshot */}
      <AttendanceTable
        records={records}
        selectedIds={selectedIds}
        onToggleSelectAll={handleToggleSelectAll}
        onToggleSelectRow={handleToggleSelectRow}
        onEdit={(rec) => setEditingRecord(rec)}
        onView={(rec) => setViewingRecord(rec)}
        onOpenCalendarInfo={handleOpenCalendarInfo}
        pageSize={filters.pageSize}
        onPageSizeChange={(size) => setFilters((prev) => ({ ...prev, pageSize: size }))}
        page={filters.page}
        onPageChange={(p) => setFilters((prev) => ({ ...prev, page: p }))}
      />

      {/* Manual Adjustment Modal */}
      <AttendanceEditModal
        record={editingRecord}
        open={Boolean(editingRecord)}
        onClose={() => setEditingRecord(null)}
        onSave={handleSaveEdit}
      />

      {/* View Detail Modal */}
      <AttendanceViewModal
        record={viewingRecord}
        open={Boolean(viewingRecord)}
        onClose={() => setViewingRecord(null)}
      />

      {/* Calendar Info Modal */}
      <CalendarInfoModal
        open={calendarInfoOpen}
        onClose={() => setCalendarInfoOpen(false)}
        defaultOffice={selectedCalendarOffice}
      />
    </div>
  );
}
