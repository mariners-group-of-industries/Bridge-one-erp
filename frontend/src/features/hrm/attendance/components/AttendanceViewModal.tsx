"use client";

import { X, Eye, Calendar, Clock, MapPin, CheckCircle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AttendanceRecord } from "../types";

interface AttendanceViewModalProps {
  record: AttendanceRecord | null;
  open: boolean;
  onClose: () => void;
}

export function AttendanceViewModal({
  record,
  open,
  onClose,
}: AttendanceViewModalProps) {
  if (!open || !record) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-xl border border-line bg-surface shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line bg-canvas px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Eye className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-ink">Attendance Log Details</h2>
              <p className="text-[11px] text-ink-muted">
                {record.employeeName} • Code: {record.employeeCode}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-ink-muted hover:bg-hover hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {/* Header Summary */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-canvas border border-line">
            <div>
              <span className="text-[10px] text-ink-muted">Designation</span>
              <div className="font-semibold text-ink">{record.designation}</div>
            </div>
            <div>
              <span className="text-[10px] text-ink-muted">Department</span>
              <div className="font-semibold text-ink">{record.department}</div>
            </div>
            <div>
              <span className="text-[10px] text-ink-muted">Date & Day</span>
              <div className="font-semibold text-ink">
                {record.date} ({record.day})
              </div>
            </div>
            <div>
              <span className="text-[10px] text-ink-muted">Assigned Calendar</span>
              <div className="font-semibold text-primary">{record.calendarName}</div>
            </div>
          </div>

          {/* Timing details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded border border-line bg-surface">
              <div className="flex items-center gap-1.5 text-ink-muted mb-1 font-medium">
                <Clock className="size-3.5 text-success" />
                In-Time Punch
              </div>
              <div className="text-sm font-bold text-ink">
                {record.inTime || "—"}
              </div>
              <div className="text-[10px] text-ink-faint flex items-center gap-1 mt-1">
                <MapPin className="size-3" />
                {record.inTimeLocation || "No Location"}
              </div>
            </div>

            <div className="p-3 rounded border border-line bg-surface">
              <div className="flex items-center gap-1.5 text-ink-muted mb-1 font-medium">
                <Clock className="size-3.5 text-primary" />
                Out-Time Punch
              </div>
              <div className="text-sm font-bold text-ink">
                {record.outTime || "—"}
              </div>
              <div className="text-[10px] text-ink-faint flex items-center gap-1 mt-1">
                <MapPin className="size-3" />
                {record.outTimeLocation || "No Location"}
              </div>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="space-y-2 border-t border-line pt-3">
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">Actual Attendance Status:</span>
              <span className="font-bold text-xs">
                {record.actualAttendance}
              </span>
            </div>
            {record.requestAttendance && (
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Requested Attendance:</span>
                <span className="font-semibold text-success">
                  {record.requestAttendance}
                </span>
              </div>
            )}
            {record.remarks && (
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Remarks:</span>
                <span className="font-medium text-ink">{record.remarks}</span>
              </div>
            )}
            {record.lastActionBy && (
              <div className="flex items-center justify-between text-[11px] text-ink-faint">
                <span>Last Action By:</span>
                <span>
                  {record.lastActionBy} ({record.lastActionTime})
                </span>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-line">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
