"use client";

import { useState } from "react";
import { X, Check, Clock, UserCheck, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AttendanceRecord } from "../types";

interface AttendanceEditModalProps {
  record: AttendanceRecord | null;
  open: boolean;
  onClose: () => void;
  onSave: (updated: Partial<AttendanceRecord>) => void;
}

export function AttendanceEditModal({ record, open, onClose, onSave }: AttendanceEditModalProps) {
  if (!open || !record) return null;
  // Keyed by record so each opened record starts from its own values.
  return <AttendanceEditForm key={record.id} record={record} onClose={onClose} onSave={onSave} />;
}

function AttendanceEditForm({
  record,
  onClose,
  onSave,
}: Omit<AttendanceEditModalProps, "open" | "record"> & { record: AttendanceRecord }) {
  const [inTime, setInTime] = useState(record.inTime || "09:00 AM");
  const [outTime, setOutTime] = useState(record.outTime || "06:00 PM");
  const [requestedStatus, setRequestedStatus] = useState(
    record.requestAttendance || "Present",
  );
  const [remarks, setRemarks] = useState(record.remarks || "Worked");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      inTime,
      outTime,
      requestAttendance: requestedStatus,
      remarks,
      actualAttendance: requestedStatus as any,
      lastActionBy: "HR Admin",
      lastActionTime: `${new Date().toISOString().slice(0, 10)} ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
    });
    onClose();
  };

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
              <Clock className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-ink">Manual Attendance Adjustment</h2>
              <p className="text-[11px] text-ink-muted">
                {record.employeeName} ({record.employeeCode}) • {record.date} ({record.day})
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

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-ink">In-Time</label>
              <input
                type="text"
                value={inTime}
                onChange={(e) => setInTime(e.target.value)}
                placeholder="e.g. 9:00 AM"
                className="w-full h-8 text-xs rounded border border-line-strong bg-surface px-2.5 text-ink focus:border-primary focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-ink">Out-Time</label>
              <input
                type="text"
                value={outTime}
                onChange={(e) => setOutTime(e.target.value)}
                placeholder="e.g. 6:00 PM"
                className="w-full h-8 text-xs rounded border border-line-strong bg-surface px-2.5 text-ink focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-ink">Requested Attendance Status</label>
            <select
              value={requestedStatus}
              onChange={(e) => setRequestedStatus(e.target.value)}
              className="w-full h-8 text-xs rounded border border-line-strong bg-surface px-2.5 text-ink focus:border-primary focus:outline-none"
            >
              <option value="Present">Present</option>
              <option value="Late">Late</option>
              <option value="Leave">Leave</option>
              <option value="Offday">Offday</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-ink">Remarks / Reason</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Worked, Official Duty, Biometric Device Error"
              className="w-full h-8 text-xs rounded border border-line-strong bg-surface px-2.5 text-ink focus:border-primary focus:outline-none"
            />
          </div>

          <div className="rounded border border-accent-line/60 bg-accent-soft/40 p-2.5 text-[11px] text-ink-muted">
            Shift: <strong className="text-ink">{record.calendarName}</strong> | Department:{" "}
            <strong className="text-ink">{record.department}</strong>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Adjustment
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
