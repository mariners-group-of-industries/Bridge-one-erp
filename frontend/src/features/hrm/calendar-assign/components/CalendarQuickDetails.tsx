import { Clock } from "lucide-react";
import type { CalendarDefinition } from "../types";

const shown = (value: string | number | null | undefined) => (value === null || value === undefined || value === "" || value === "-" ? "—" : String(value));

/**
 * One calendar's timings at a glance (HR Governance › Calendar Setup): shift
 * time, minimum work hours, grace, last start, min in / max out and break.
 * `compact` is the narrow layout for the cell's Pick Shift popover.
 */
export function CalendarQuickDetails({ calendar, compact = false }: { calendar: CalendarDefinition; compact?: boolean }) {
  if (calendar.startTime === "-" || !calendar.startTime) {
    return <p className="text-[11px] text-ink-muted">{calendar.calendarName}: no shift timings (not a working day).</p>;
  }
  const items: [string, string][] = [
    ["Office", shown(calendar.office)],
    ["Shift", `${shown(calendar.startTime)} – ${shown(calendar.endTime)}`],
    ["Min Work Hour", calendar.minWorkHour ? `${calendar.minWorkHour} hrs` : "—"],
    ["Grace Time", shown(calendar.graceTime)],
    ["Last Start Time", shown(calendar.lastStartTime)],
    ["Min In Time", shown(calendar.minInTime)],
    ["Max Out Time", shown(calendar.maxOutTime)],
    ["Break", calendar.breakStartTime && calendar.breakStartTime !== "-" ? `${calendar.breakStartTime} – ${shown(calendar.breakEndTime)}` : "—"],
  ];
  const list = compact ? items.filter(([label]) => label !== "Office") : items;

  return (
    <dl className={compact ? "grid grid-cols-2 gap-x-2 gap-y-1" : "grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4 lg:grid-cols-8"}>
      {list.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className={compact ? "text-[9px] text-ink-faint" : "text-[11px] font-medium text-ink-muted"}>{label}</dt>
          <dd className={`truncate font-mono font-semibold text-ink ${compact ? "text-[10px]" : "text-xs"} ${label === "Grace Time" ? "text-amber-700 dark:text-amber-400" : ""}`} title={value}>
            {label === "Shift" && !compact && <Clock className="mr-1 inline size-3 align-[-2px] text-ink-faint" aria-hidden />}
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
