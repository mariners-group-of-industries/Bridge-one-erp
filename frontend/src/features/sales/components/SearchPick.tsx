"use client";

import { useId, useState } from "react";
import { CONTROL } from "@/components/ui/form-field";
import { cn } from "@/lib/cn";

/**
 * Searchable picker: suggestions appear after 3 letters. Picks an option by its label
 * (`onPick`), or with `freeText` keeps whatever is typed (`onText`).
 */
export function SearchPick({
  label,
  options,
  selectedId,
  onPick,
  freeText,
  text,
  onText,
  required,
  error,
  disabled,
  placeholder,
  onSearch,
  hideLabel,
}: {
  label: string;
  options: { id: string; label: string }[];
  selectedId?: string;
  onPick?: (id: string | null) => void;
  freeText?: boolean;
  text?: string;
  onText?: (text: string) => void;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  /** Called with the typed text, for options loaded from the server. */
  onSearch?: (text: string) => void;
  /** Keep the label for screen readers only (e.g. inside a table row). */
  hideLabel?: boolean;
}) {
  const id = useId();
  const labelOf = (optionId: string | undefined) => options.find((option) => option.id === optionId)?.label ?? "";
  const [typed, setTyped] = useState(() => labelOf(selectedId));
  // Follow selections made elsewhere (a new customer, Save & New), not the ones typed here.
  const [synced, setSynced] = useState(selectedId ?? "");
  if ((selectedId ?? "") !== synced) {
    setSynced(selectedId ?? "");
    setTyped(labelOf(selectedId));
  }
  const value = freeText ? (text ?? "") : typed;
  const needle = value.trim().toLowerCase();
  const matches = needle.length >= 3 ? options.filter((option) => option.label.toLowerCase().includes(needle)).slice(0, 50) : [];

  function change(next: string) {
    onSearch?.(next);
    if (freeText) {
      onText?.(next);
      return;
    }
    setTyped(next);
    const match = options.find((option) => option.label === next);
    if (match) {
      setSynced(match.id);
      onPick?.(match.id);
    } else if (selectedId) {
      setSynced("");
      onPick?.(null);
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <label htmlFor={`${id}-input`} className={hideLabel ? "sr-only" : "text-xs text-ink-muted"}>
        {label} {required && <span className="text-danger">*</span>}
      </label>
      <input
        id={`${id}-input`}
        list={`${id}-list`}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        onChange={(event) => change(event.target.value)}
        className={cn(CONTROL, "h-7", error && "ring-1 ring-danger")}
      />
      <datalist id={`${id}-list`}>
        {matches.map((option) => (
          <option key={option.id} value={option.label} />
        ))}
      </datalist>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
