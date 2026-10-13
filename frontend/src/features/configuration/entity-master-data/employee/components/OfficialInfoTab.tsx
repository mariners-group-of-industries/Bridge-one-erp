"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { Field, FormGrid, Input, Panel, Select } from "./kit";

const CALENDAR_TYPES = ["Gregorian", "Hijri", "Bengali"] as const;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function CalendarGrid({
  year,
  month,
  offDays,
  onToggle,
}: {
  year: number;
  /** 0-indexed */
  month: number;
  offDays: Set<string>;
  onToggle: (key: string) => void;
}) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="overflow-hidden rounded-md border border-line">
      <div className="grid grid-cols-7 border-b border-line bg-canvas">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-ink-muted">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} className="h-10 border-r border-b border-line bg-canvas/50 [&:nth-child(7n)]:border-r-0" />;
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isOff = offDays.has(key);
          return (
            <button
              key={key}
              type="button"
              aria-pressed={isOff}
              aria-label={`${key}${isOff ? ", off day" : ""}`}
              onClick={() => onToggle(key)}
              className={cn(
                "flex h-10 items-center justify-center border-r border-b border-line text-sm tabular-nums transition-colors focus-visible:z-10 focus-visible:outline-2 [&:nth-child(7n)]:border-r-0",
                isOff
                  ? "bg-danger/10 font-semibold text-danger hover:bg-danger/15"
                  : "text-ink hover:bg-accent-soft hover:text-accent-strong",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function OfficialInfoTab({ employeeId }: { employeeId: string }) {
  const toast = useToast();
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  const [generateDate, setGenerateDate] = useState(todayIso);
  const [calendarType, setCalendarType] = useState<string>(CALENDAR_TYPES[0]);
  const [effectiveDate, setEffectiveDate] = useState(todayIso);
  const [offDays, setOffDays] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const monthLabel = new Date(viewYear, viewMonth).toLocaleString("default", { month: "long", year: "numeric" });

  const shiftMonth = (delta: -1 | 1) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const toggleOffDay = (key: string) =>
    setOffDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const reset = () => {
    setOffDays(new Set());
    setGenerateDate(todayIso);
    setEffectiveDate(todayIso);
    setCalendarType(CALENDAR_TYPES[0]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // TODO: wire up API call with { employeeId, generateDate, calendarType, effectiveDate, offDays: [...offDays] }
      await new Promise((r) => setTimeout(r, 600)); // placeholder
      toast.success("Official info saved.");
    } catch {
      toast.error("Failed to save official info.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-6">
      <Panel title="Calendar Settings" description="Calendar used to generate this employee's working days.">
        <FormGrid>
          <Field label="Generate Date" required>
            {(id) => <Input id={id} type="date" value={generateDate} onChange={(e) => setGenerateDate(e.target.value)} />}
          </Field>
          <Field label="Calendar Type" required>
            {(id) => (
              <Select id={id} placeholder={false} value={calendarType} onChange={(e) => setCalendarType(e.target.value)} options={CALENDAR_TYPES} />
            )}
          </Field>
          <Field label="Effective Date" required>
            {(id) => <Input id={id} type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />}
          </Field>
        </FormGrid>
      </Panel>

      <Panel
        title="Off Days"
        description="Click a date to mark it as an off day; click again to make it a working day."
        actions={
          <div className="flex items-center gap-1">
            {offDays.size > 0 && (
              <span className="mr-2 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
                {offDays.size} off {offDays.size === 1 ? "day" : "days"}
              </span>
            )}
            <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
              <ChevronLeft />
            </Button>
            <span className="min-w-32 text-center text-sm font-semibold text-ink" aria-live="polite">
              {monthLabel}
            </span>
            <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => shiftMonth(1)}>
              <ChevronRight />
            </Button>
          </div>
        }
        footer={
          <>
            <Button onClick={reset} disabled={isSaving}>
              Reset
            </Button>
            <Button variant="accent" loading={isSaving} onClick={handleSave}>
              Save
            </Button>
          </>
        }
      >
        <CalendarGrid year={viewYear} month={viewMonth} offDays={offDays} onToggle={toggleOffDay} />
      </Panel>
    </div>
  );
}
