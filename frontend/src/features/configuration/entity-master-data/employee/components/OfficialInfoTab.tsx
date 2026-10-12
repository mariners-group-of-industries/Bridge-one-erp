"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

// ─── Constants ────────────────────────────────────────────────────────────────

const CALENDAR_TYPES = ["Gregorian", "Hijri", "Bengali"] as const;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

// ─── Primitives ───────────────────────────────────────────────────────────────

const CTRL =
  "h-8 w-full rounded-md border border-line bg-surface px-2.5 text-sm text-ink " +
  "placeholder:text-ink-faint transition-colors " +
  "hover:border-line-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-line " +
  "disabled:cursor-not-allowed disabled:bg-control disabled:text-ink-faint";

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 px-6 py-5 not-first:border-t not-first:border-line">
      <div className="flex items-center gap-2">
        <span className="h-4 w-0.5 rounded-full bg-accent-strong" />
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Field({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-ink-muted">
        {label}
        {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
      </label>
      {children}
    </div>
  );
}

// ─── Calendar grid ────────────────────────────────────────────────────────────

function CalendarGrid({
  year, month, offDays, onToggle,
}: {
  year: number;
  month: number; // 0-indexed
  offDays: Set<string>;
  onToggle: (key: string) => void;
}) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array<null>(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-line bg-canvas">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1.5 text-center text-xs font-semibold text-ink-muted">
            {d}
          </div>
        ))}
      </div>
      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} className="h-9 border-b border-r border-line last:border-r-0" />;
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isOff = offDays.has(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onToggle(key)}
              title={isOff ? "Mark as working day" : "Mark as off day"}
              className={
                "flex h-9 items-center justify-center border-b border-r border-line text-sm transition-colors last:border-r-0 " +
                (isOff
                  ? "bg-danger/10 font-semibold text-danger hover:bg-danger/20"
                  : "text-ink hover:bg-accent-soft hover:text-accent-strong")
              }
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OfficialInfoTab({ employeeId }: { employeeId: string }) {
  const toast = useToast();
  const today = new Date();

  const [generateDate, setGenerateDate] = useState(today.toISOString().slice(0, 10));
  const [calendarType, setCalendarType] = useState<string>(CALENDAR_TYPES[0]);
  const [effectiveDate, setEffectiveDate] = useState(today.toISOString().slice(0, 10));
  const [offDays, setOffDays] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Calendar navigation
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const monthLabel = new Date(viewYear, viewMonth).toLocaleString("default", {
    month: "long", year: "numeric",
  });

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const toggleOffDay = (key: string) => {
    setOffDays((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
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
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm pb-0">

      {/* ── Settings ── */}
      <FormSection title="Calendar Settings">
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Generate Date" required>
            <input
              type="date"
              className={CTRL}
              value={generateDate}
              onChange={(e) => setGenerateDate(e.target.value)}
            />
          </Field>
          <Field label="Calendar Type" required>
            <select
              className={CTRL}
              value={calendarType}
              onChange={(e) => setCalendarType(e.target.value)}
            >
              {CALENDAR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Effective Date" required>
            <input
              type="date"
              className={CTRL}
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
          </Field>
        </div>
      </FormSection>

      {/* ── Calendar + off-day assignment ── */}
      <FormSection title="Calendar & Off Day Assignment">
        <div className="flex flex-col gap-3">
          {/* Month navigation */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={prevMonth}
              className="flex size-7 items-center justify-center rounded-md border border-line text-ink-muted hover:bg-canvas"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-36 text-center text-sm font-semibold text-ink">{monthLabel}</span>
            <button
              type="button"
              onClick={nextMonth}
              className="flex size-7 items-center justify-center rounded-md border border-line text-ink-muted hover:bg-canvas"
            >
              <ChevronRight className="size-4" />
            </button>
            {offDays.size > 0 && (
              <span className="ml-2 rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-medium text-danger">
                {offDays.size} off {offDays.size === 1 ? "day" : "days"} assigned
              </span>
            )}
          </div>

          <CalendarGrid
            year={viewYear}
            month={viewMonth}
            offDays={offDays}
            onToggle={toggleOffDay}
          />

          <p className="text-xs text-ink-faint">Click a date to toggle it as an off day (shown in red).</p>
        </div>
      </FormSection>

      {/* ── Save ── */}
      <div className="flex items-center justify-end gap-2 border-t border-line bg-canvas px-6 py-3">
        <Button
          variant="secondary"
          size="md"
          onClick={() => {
            setOffDays(new Set());
            setGenerateDate(today.toISOString().slice(0, 10));
            setEffectiveDate(today.toISOString().slice(0, 10));
            setCalendarType(CALENDAR_TYPES[0]);
          }}
          disabled={isSaving}
        >
          Reset
        </Button>
        <Button variant="accent" size="md" loading={isSaving} onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  );
}
