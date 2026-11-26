"use client";

import { CalendarDays } from "lucide-react";
import { useImperativeHandle, useRef, useState, type ChangeEvent, type InputHTMLAttributes, type Ref } from "react";
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

// ─── Drop-in for <input type="date" | "datetime-local"> ───────────────────────

/** "2026-11-15T09:30" → "15/11/2026 09:30". */
export const isoToDmyTime = (iso: string) => {
  const day = isoToDmy(iso);
  const time = /T(\d{2}:\d{2})/.exec(iso)?.[1];
  return day && time ? `${day} ${time}` : day;
};

/** "15/11/2026 09:30" (time optional, 00:00 when left out) → "2026-11-15T09:30"; null when not real. */
export const dmyTimeToIso = (text: string): string | null => {
  const match = /^(\S+?)(?:[ ,T]+(\d{1,2}):(\d{2}))?$/.exec(text.trim());
  if (!match) return null;
  const day = dmyToIso(match[1]);
  const [hour, minute] = [Number(match[2] ?? 0), Number(match[3] ?? 0)];
  if (!day || hour > 23 || minute > 59) return null;
  return `${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

/** Classes that place the field in its layout belong on the wrapper, not the text box. */
const LAYOUT_CLASS = /^(?:[\w-]+:)*-?(?:w-|min-w-|max-w-|flex-|grow|shrink|basis-|col-|row-|self-|justify-self-|order-|m[trblxyse]?-|hidden$|block$|inline)/;

type NativeDateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  type?: "date" | "datetime-local";
  ref?: Ref<HTMLInputElement>;
};

/**
 * Takes the same props as `<input type="date">` (value "YYYY-MM-DD", onChange
 * with `event.target.value`, name, min, max …) but always shows and accepts
 * DD/MM/YYYY (with "HH:mm" for datetime-local), whatever the browser language.
 * The calendar button opens the browser's own picker. `event.target` is the
 * hidden native input, so `name`, `value` and `valueAsDate` work as before,
 * and the value is posted with a form under `name`.
 */
export function NativeDateInput({ type = "date", value, defaultValue, onChange, onBlur, onKeyDown, className, style, name, min, max, step, required, disabled, readOnly, placeholder, ref, ...rest }: NativeDateInputProps) {
  const withTime = type === "datetime-local";
  const toText = withTime ? isoToDmyTime : isoToDmy;
  const toIso = withTime ? dmyTimeToIso : dmyToIso;
  const controlled = value !== undefined;
  const [inner, setInner] = useState(() => String(defaultValue ?? ""));
  const current = controlled ? String(value ?? "") : inner;
  const [text, setText] = useState(() => toText(current));
  const [shown, setShown] = useState(current);
  const picker = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLInputElement>(null);
  // Callers that focus or read the field get the visible box; its value is the date as shown.
  useImperativeHandle(ref, () => box.current as HTMLInputElement);

  // Follow the value when it changes from outside (a reset, a picked date).
  if (current !== shown) {
    setShown(current);
    setText(toText(current));
  }

  const inRange = (iso: string) => (!min || iso.slice(0, 16) >= String(min).slice(0, 16)) && (!max || iso.slice(0, 16) <= String(max).slice(0, 16));

  const emit = (iso: string) => {
    if (iso === current) return;
    const native = picker.current;
    if (native) native.value = iso;
    if (!controlled) setInner(iso);
    if (native && onChange) {
      const event = { target: native, currentTarget: native, type: "change", bubbles: true, defaultPrevented: false, preventDefault() {}, stopPropagation() {}, isDefaultPrevented: () => false, isPropagationStopped: () => false, persist() {} };
      onChange(event as unknown as ChangeEvent<HTMLInputElement>);
    }
  };

  const commit = (next: string) => {
    if (!next.trim()) return emit("");
    const iso = toIso(next);
    if (iso && inRange(iso)) emit(iso);
    else setText(toText(current)); // Not a real date (or out of range): put the last good value back.
  };

  const classes = (className ?? "").split(/\s+/).filter(Boolean);
  const layout = classes.filter((c) => LAYOUT_CLASS.test(c));
  const own = classes.filter((c) => !LAYOUT_CLASS.test(c));
  const locked = disabled || readOnly;

  return (
    <span className={cn("relative inline-block align-middle", layout.join(" "))} style={style}>
      <input
        {...rest}
        ref={box}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder ?? (withTime ? "dd/mm/yyyy hh:mm" : "dd/mm/yyyy")}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const iso = toIso(e.target.value);
          // Emit while typing only once the whole date (and time) is there.
          if (iso && inRange(iso) && (!withTime || /\d:\d{2}$/.test(e.target.value.trim()))) emit(iso);
        }}
        onBlur={(e) => {
          commit(e.target.value);
          onBlur?.(e);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit(e.currentTarget.value);
          onKeyDown?.(e);
        }}
        className={cn(own.join(" "), "w-full pr-8")}
      />
      <button
        type="button"
        disabled={locked}
        tabIndex={-1}
        aria-label="Open calendar"
        title="Open calendar"
        onClick={() => {
          const el = picker.current;
          if (!el) return;
          try {
            el.showPicker();
          } catch {
            box.current?.focus();
          }
        }}
        className="absolute inset-y-0 right-0 flex w-8 min-h-6 items-center justify-center text-ink-faint hover:text-ink disabled:cursor-not-allowed"
      >
        <CalendarDays className="size-3.5" aria-hidden="true" />
      </button>
      {/* The browser's picker, kept out of sight; only its calendar is shown. It also carries `name` for forms. */}
      <input
        ref={picker}
        type={type}
        name={name}
        min={min}
        max={max}
        step={step}
        tabIndex={-1}
        aria-hidden="true"
        value={current}
        onChange={(e) => emit(e.target.value)}
        className="pointer-events-none absolute right-0 bottom-0 h-px w-px opacity-0"
      />
    </span>
  );
}
