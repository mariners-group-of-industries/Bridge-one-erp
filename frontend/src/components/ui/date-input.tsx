"use client";

import { CalendarDays } from "lucide-react";
import { useRef, useState, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** "2026-11-15" → "15/11/2026". */
export const isoToDmy = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : "";
};

/** "15/11/2026" (or 15-11-2026, 15.11.2026) → "2026-11-15"; null when it is not a real date. */
export const dmyToIso = (text: string): string | null => {
  const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text.trim());
  if (!match) return null;
  const [, d, m, y] = match;
  const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
};

type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  /** The date as YYYY-MM-DD ("" for none). */
  value: string;
  onChange: (iso: string) => void;
};

/**
 * A date field that always reads and accepts DD/MM/YYYY, whatever the
 * browser's language. The calendar button opens the browser's own picker.
 */
export function DateInput({ value, onChange, className, disabled, ...props }: DateInputProps) {
  const [text, setText] = useState(isoToDmy(value));
  const [shown, setShown] = useState(value);
  const picker = useRef<HTMLInputElement>(null);

  // Follow the value when it changes from outside (a reset, a picked date).
  if (value !== shown) {
    setShown(value);
    setText(isoToDmy(value));
  }

  const commit = (next: string) => {
    if (!next.trim()) return onChange("");
    const iso = dmyToIso(next);
    if (iso) onChange(iso);
    else setText(isoToDmy(value)); // Not a real date: put the last good value back.
  };

  return (
    <div className="relative">
      <input
        {...props}
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/yyyy"
        autoComplete="off"
        disabled={disabled}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const iso = dmyToIso(e.target.value);
          if (iso) onChange(iso);
        }}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
        }}
        className={cn("pr-9", className)}
      />
      <button
        type="button"
        disabled={disabled}
        aria-label="Open calendar"
        title="Open calendar"
        onClick={() => {
          const el = picker.current;
          if (!el) return;
          try {
            el.showPicker();
          } catch {
            el.focus();
          }
        }}
        className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-ink-faint hover:text-ink disabled:cursor-not-allowed"
      >
        <CalendarDays className="size-3.5" aria-hidden="true" />
      </button>
      {/* The browser's picker, kept out of sight; only its calendar is shown. */}
      <input
        ref={picker}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pointer-events-none absolute right-0 bottom-0 h-px w-px opacity-0"
      />
    </div>
  );
}
