"use client";

import { useState } from "react";
import {
  Pencil,
  Eye,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Check,
} from "lucide-react";
import type { AttendanceRecord } from "../types";

interface AttendanceTableProps {
  records: AttendanceRecord[];
  selectedIds: Set<string>;
  onToggleSelectAll: () => void;
  onToggleSelectRow: (id: string) => void;
  onEdit: (record: AttendanceRecord) => void;
  onView: (record: AttendanceRecord) => void;
  onOpenCalendarInfo?: (calendarName: string) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  page: number;
  onPageChange: (page: number) => void;
}

export function AttendanceTable({
  records,
  selectedIds,
  onToggleSelectAll,
  onToggleSelectRow,
  onEdit,
  onView,
  onOpenCalendarInfo,
  pageSize,
  onPageSizeChange,
  page,
  onPageChange,
}: AttendanceTableProps) {
  const allSelected =
    records.length > 0 && records.every((r) => selectedIds.has(r.id));
  const someSelected =
    records.some((r) => selectedIds.has(r.id)) && !allSelected;

  const totalPages = Math.ceil(records.length / pageSize) || 1;
  const startIdx = (page - 1) * pageSize;
  const paginatedRecords = records.slice(startIdx, startIdx + pageSize);

  // Status color styles matching the user's screenshot
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Present":
        return "text-[#16a34a] font-medium"; // Green
      case "Late":
        return "text-[#ea580c] font-medium"; // Orange/Amber
      case "Absent":
        return "text-[#dc2626] font-medium"; // Red
      case "Offday":
        return "text-[#7c3aed] font-medium"; // Purple
      case "Holiday":
        return "text-[#0284c7] font-medium"; // Blue
      case "Leave":
        return "text-[#d97706] font-medium"; // Amber
      default:
        return "text-ink";
    }
  };

  return (
    <div className="rounded-md border border-grid-line bg-surface shadow-xs overflow-hidden">
      {/* Scrollable table container */}
      <div className="relative overflow-x-auto max-h-[620px] overflow-y-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 z-30 bg-grid-head text-grid-head-ink border-b-2 border-grid-head-rule shadow-xs">
            <tr className="whitespace-nowrap">
              {/* Checkbox */}
              <th className="sticky left-0 z-40 bg-grid-head px-2.5 py-2.5 w-10 text-center border-r border-grid-line">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={onToggleSelectAll}
                  className="size-3.5 rounded border-grid-line text-primary focus:ring-primary accent-primary cursor-pointer"
                />
              </th>

              {/* SL */}
              <th className="px-2 py-2.5 w-12 text-center font-bold border-r border-grid-line">
                SL
              </th>

              {/* Action */}
              <th className="px-3 py-2.5 text-center font-bold border-r border-grid-line">
                Action
              </th>

              {/* Employee Code */}
              <th className="px-3 py-2.5 font-bold border-r border-grid-line">
                Employee Co...
              </th>

              {/* Employee Name */}
              <th className="px-3 py-2.5 font-bold border-r border-grid-line min-w-[140px]">
                Employee
              </th>

              {/* Designation */}
              <th className="px-3 py-2.5 font-bold border-r border-grid-line">
                Designation
              </th>

              {/* Department */}
              <th className="px-3 py-2.5 font-bold border-r border-grid-line">
                Department
              </th>

              {/* Department Section */}
              <th className="px-3 py-2.5 font-bold border-r border-grid-line">
                Department ...
              </th>

              {/* Date */}
              <th className="px-3 py-2.5 font-bold border-r border-grid-line">
                Date
              </th>

              {/* Day */}
              <th className="px-2.5 py-2.5 text-center font-bold border-r border-grid-line">
                Day
              </th>

              {/* Calendar */}
              <th className="px-3 py-2.5 font-bold border-r border-grid-line">
                Calendar
              </th>

              {/* In-Time */}
              <th className="px-3 py-2.5 font-bold border-r border-grid-line">
                In-Time
              </th>

              {/* Out-Time */}
              <th className="px-3 py-2.5 font-bold border-r border-grid-line">
                Out-Time
              </th>

              {/* In-Time Location */}
              <th className="px-3 py-2.5 font-bold border-r border-grid-line">
                In-Time Loca...
              </th>

              {/* Out-Time Location */}
              <th className="px-3 py-2.5 font-bold border-r border-grid-line">
                Out-Time Loc...
              </th>

              {/* Actual Attendance */}
              <th className="px-3 py-2.5 font-bold border-r border-grid-line">
                Actual Attend...
              </th>

              {/* Request Attendance */}
              <th className="px-3 py-2.5 font-bold border-r border-grid-line">
                Request Atte...
              </th>

              {/* Remarks */}
              <th className="px-3 py-2.5 font-bold border-r border-grid-line">
                Remarks
              </th>

              {/* Last Action By */}
              <th className="px-3 py-2.5 font-bold border-r border-grid-line">
                Last Action By
              </th>

              {/* Last Action Time */}
              <th className="px-3 py-2.5 font-bold">
                Last Action T...
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-grid-line whitespace-nowrap">
            {paginatedRecords.length === 0 ? (
              <tr>
                <td
                  colSpan={20}
                  className="py-12 text-center text-ink-muted text-sm font-medium"
                >
                  No attendance records found matching the filter criteria.
                </td>
              </tr>
            ) : (
              paginatedRecords.map((r) => {
                const isSelected = selectedIds.has(r.id);

                return (
                  <tr
                    key={r.id}
                    className={`transition-colors hover:bg-grid-hover ${
                      isSelected ? "bg-accent-soft/40" : ""
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="sticky left-0 z-20 bg-surface px-2.5 py-2 text-center border-r border-grid-line">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelectRow(r.id)}
                        className="size-3.5 rounded border-grid-line text-primary focus:ring-primary accent-primary cursor-pointer"
                      />
                    </td>

                    {/* SL */}
                    <td className="px-2 py-2 text-center text-ink font-mono text-[11px] border-r border-grid-line">
                      {r.sl}
                    </td>

                    {/* Action */}
                    <td className="px-2.5 py-2 text-center border-r border-grid-line">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onEdit(r)}
                          className="rounded p-1 text-primary hover:bg-accent-soft transition-colors"
                          title="Edit / Manual Attendance Adjustment"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onView(r)}
                          className="rounded p-1 text-primary hover:bg-accent-soft transition-colors"
                          title="View Attendance Details"
                        >
                          <Eye className="size-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Employee Code */}
                    <td className="px-3 py-2 font-mono text-[11px] text-ink border-r border-grid-line">
                      {r.employeeCode}
                    </td>

                    {/* Employee Name */}
                    <td className="px-3 py-2 font-medium text-ink border-r border-grid-line">
                      {r.employeeName}
                    </td>

                    {/* Designation */}
                    <td className="px-3 py-2 text-ink-muted border-r border-grid-line">
                      {r.designation}
                    </td>

                    {/* Department */}
                    <td className="px-3 py-2 text-ink-muted border-r border-grid-line">
                      {r.department}
                    </td>

                    {/* Department Section */}
                    <td className="px-3 py-2 text-ink-faint border-r border-grid-line">
                      {r.departmentSection}
                    </td>

                    {/* Date */}
                    <td className="px-3 py-2 font-mono text-[11px] text-ink border-r border-grid-line">
                      {r.date}
                    </td>

                    {/* Day */}
                    <td className="px-2.5 py-2 text-center text-ink-muted font-medium border-r border-grid-line">
                      {r.day}
                    </td>

                    {/* Calendar Link */}
                    <td className="px-3 py-2 border-r border-grid-line">
                      <button
                        type="button"
                        onClick={() => onOpenCalendarInfo?.(r.calendarName)}
                        className="text-primary hover:underline font-medium cursor-pointer"
                      >
                        {r.calendarName}
                      </button>
                    </td>

                    {/* In-Time */}
                    <td className="px-3 py-2 font-mono text-[11px] text-ink border-r border-grid-line">
                      {r.inTime || ""}
                    </td>

                    {/* Out-Time */}
                    <td className="px-3 py-2 font-mono text-[11px] text-ink border-r border-grid-line">
                      {r.outTime || ""}
                    </td>

                    {/* In-Time Location */}
                    <td className="px-3 py-2 text-ink-faint border-r border-grid-line">
                      {r.inTimeLocation || ""}
                    </td>

                    {/* Out-Time Location */}
                    <td className="px-3 py-2 text-ink-faint border-r border-grid-line">
                      {r.outTimeLocation || ""}
                    </td>

                    {/* Actual Attendance Status */}
                    <td className="px-3 py-2 border-r border-grid-line">
                      <span className={getStatusColor(r.actualAttendance)}>
                        {r.actualAttendance}
                      </span>
                    </td>

                    {/* Request Attendance */}
                    <td className="px-3 py-2 border-r border-grid-line text-[#16a34a] font-medium">
                      {r.requestAttendance || ""}
                    </td>

                    {/* Remarks */}
                    <td className="px-3 py-2 text-ink-muted border-r border-grid-line">
                      {r.remarks || ""}
                    </td>

                    {/* Last Action By */}
                    <td className="px-3 py-2 text-ink-faint border-r border-grid-line">
                      {r.lastActionBy || ""}
                    </td>

                    {/* Last Action Time */}
                    <td className="px-3 py-2 text-ink-faint font-mono text-[10px]">
                      {r.lastActionTime || ""}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer matching screenshot: "Showing 1–32 of 32 Rows", "Rows [ 50 v ]", "< [ 1 ] >" */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-grid-line bg-canvas px-4 py-2.5 text-xs text-ink-muted">
        <div className="flex items-center gap-3">
          <span>
            Showing{" "}
            <strong>
              {records.length === 0 ? 0 : startIdx + 1}–
              {Math.min(startIdx + pageSize, records.length)}
            </strong>{" "}
            of <strong>{records.length}</strong> Rows
          </span>

          <div className="flex items-center gap-1.5 pl-2 border-l border-line">
            <span>Rows</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="h-6 rounded border border-line bg-surface px-1.5 text-xs text-ink focus:border-primary focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Pagination buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="flex size-7 items-center justify-center rounded border border-line bg-surface text-ink hover:bg-hover disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Previous page"
          >
            <ChevronLeft className="size-3.5" />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`flex size-7 items-center justify-center rounded font-semibold text-xs transition-colors ${
                p === page
                  ? "bg-primary text-white"
                  : "border border-line bg-surface text-ink hover:bg-hover"
              }`}
            >
              {p}
            </button>
          ))}

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="flex size-7 items-center justify-center rounded border border-line bg-surface text-ink hover:bg-hover disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Next page"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
