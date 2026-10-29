"use client";

import { useState } from "react";
import { Sparkles, CheckCheck, CalendarOff, RotateCcw } from "lucide-react";
import { CALENDAR_DEFINITIONS } from "../constants";
import type { CalendarDefinition } from "../types";

interface BulkAssignToolbarProps {
  selectedShift: string;
  onSelectShift: (code: string) => void;
  onApplyToAll: (shiftCode: string, mode: "all" | "working_days" | "selected_only") => void;
  onSetWeeklyOffs: (dayOfWeek: number) => void; // 5 = Friday
  onResetAll: () => void;
  selectedCount: number;
  totalFilteredCount: number;
  isAssignAll: boolean;
}

export function BulkAssignToolbar({
  selectedShift,
  onSelectShift,
  onApplyToAll,
  onSetWeeklyOffs,
  onResetAll,
  selectedCount,
  totalFilteredCount,
  isAssignAll,
}: BulkAssignToolbarProps) {
  const [applyMode, setApplyMode] = useState<"working_days" | "all">("working_days");

  const regularCalendars = CALENDAR_DEFINITIONS.filter(
    (c) => c.shortCode !== "OFF" && c.shortCode !== "HOL",
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface p-3 shadow-2xs">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
            <Sparkles className="size-3.5 text-primary" />
            Quick Assign Shift:
          </span>
          <select
            value={selectedShift}
            onChange={(e) => onSelectShift(e.target.value)}
            className="h-8 text-xs font-medium rounded border border-line-strong bg-canvas px-2.5 text-ink focus:border-primary focus:outline-none"
          >
            <option value="">-- Choose Calendar --</option>
            {regularCalendars.map((c) => (
              <option key={c.shortCode} value={c.shortCode}>
                [{c.shortCode}] {c.calendarName} ({c.startTime} - {c.endTime}) - {c.office}
              </option>
            ))}
            <option value="OFF">[OFF] Weekly Off</option>
            <option value="HOL">[HOL] Holiday</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-xs text-ink-muted">Scope:</label>
          <select
            value={applyMode}
            onChange={(e) => setApplyMode(e.target.value as "working_days" | "all")}
            className="h-8 text-xs rounded border border-line bg-surface px-2 text-ink focus:border-primary focus:outline-none"
          >
            <option value="working_days">Working Days (Skip Fridays)</option>
            <option value="all">All Days in Month</option>
          </select>
        </div>

        <button
          type="button"
          disabled={!selectedShift}
          onClick={() =>
            onApplyToAll(
              selectedShift,
              selectedCount > 0 && !isAssignAll ? "selected_only" : applyMode,
            )
          }
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded text-xs font-semibold text-white bg-accent-strong hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs transition-colors"
        >
          <CheckCheck className="size-3.5" />
          {isAssignAll || selectedCount === 0
            ? `Apply to All (${totalFilteredCount} Employees)`
            : `Apply to Selected (${selectedCount} Employees)`}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onSetWeeklyOffs(5)} // 5 = Friday
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded text-xs font-medium border border-line bg-control text-ink hover:bg-hover transition-colors"
          title="Mark all Fridays as OFF day"
        >
          <CalendarOff className="size-3.5 text-danger" />
          Set Fridays as OFF
        </button>

        <button
          type="button"
          onClick={onResetAll}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded text-xs font-medium border border-line bg-surface text-ink-muted hover:text-ink hover:bg-hover transition-colors"
          title="Reset shifts to default office calendars"
        >
          <RotateCcw className="size-3.5" />
          Reset Defaults
        </button>
      </div>
    </div>
  );
}
