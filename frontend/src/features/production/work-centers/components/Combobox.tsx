"use client";

import { ChevronDown, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CONTROL } from "@/components/ui/form-field";
import { cn } from "@/lib/cn";

export interface ComboOption {
  value: string;
  label: string;
}

type Common = {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  placeholder?: string;
  disabled?: boolean;
  options: readonly ComboOption[];
  /** Labels of chosen values that are not in `options` (e.g. a search that moved on). */
  selectedLabels?: Readonly<Record<string, string>>;
  /** Called as the user types; with `filter={false}` the parent supplies matching `options`. */
  onQueryChange?: (query: string) => void;
  filter?: boolean;
  loading?: boolean;
  emptyText?: string;
  className?: string;
};

type Props = Common & ({ multiple?: false; value: string; onChange: (value: string) => void } | { multiple: true; value: string[]; onChange: (value: string[]) => void });

/**
 * Searchable dropdown (as in Managerium): type to filter, ▾ to open, × to clear. With
 * `multiple`, each option has a checkbox and the list stays open while picking.
 */
export function Combobox(props: Props) {
  const { label, required, error, hint, placeholder, disabled, options, selectedLabels, onQueryChange, filter = true, loading, emptyText = "No match.", className } = props;
  const id = useId();
  const listId = `${id}-list`;
  const messageId = `${id}-message`;
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const chosen = props.multiple ? props.value : props.value ? [props.value] : [];
  const labelOf = (value: string) => options.find((option) => option.value === value)?.label ?? selectedLabels?.[value] ?? "";
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return filter && needle ? options.filter((option) => option.label.toLowerCase().includes(needle)) : options;
  }, [options, query, filter]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) closeList();
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  });

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function changeQuery(next: string) {
    setQuery(next);
    setActive(0);
    onQueryChange?.(next);
  }

  function openList() {
    if (disabled || open) return;
    setOpen(true);
    const index = shown.findIndex((option) => chosen.includes(option.value));
    setActive(Math.max(index, 0));
  }

  function closeList() {
    setOpen(false);
    if (query) changeQuery("");
  }

  function pick(option: ComboOption) {
    if (props.multiple) {
      props.onChange(props.value.includes(option.value) ? props.value.filter((value) => value !== option.value) : [...props.value, option.value]);
      input.current?.focus();
    } else {
      props.onChange(option.value);
      closeList();
    }
  }

  function clear() {
    if (props.multiple) props.onChange([]);
    else props.onChange("");
    changeQuery("");
    input.current?.focus();
  }

  const summary = chosen.map(labelOf).filter(Boolean).join(", ");
  return (
    <div ref={root} className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-xs font-semibold text-ink-muted">
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <div className="relative">
        <input
          ref={input}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && shown[active] ? `${id}-${active}` : undefined}
          aria-invalid={!!error || undefined}
          aria-describedby={error || hint ? messageId : undefined}
          autoComplete="off"
          disabled={disabled}
          placeholder={open && summary ? summary : placeholder}
          value={open ? query : summary}
          title={summary || undefined}
          onFocus={openList}
          onClick={openList}
          onChange={(event) => {
            if (!open) setOpen(true);
            changeQuery(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              if (!open) return openList();
              const step = event.key === "ArrowDown" ? 1 : -1;
              setActive((current) => (shown.length ? (current + step + shown.length) % shown.length : 0));
            } else if (event.key === "Enter" && open) {
              event.preventDefault();
              if (shown[active]) pick(shown[active]);
            } else if (event.key === "Escape" && open) {
              event.preventDefault();
              closeList();
            } else if (event.key === "Tab") {
              closeList();
            }
          }}
          className={cn(CONTROL, "h-8 truncate pr-14", error && "border-danger focus:border-danger focus:ring-danger")}
        />
        <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
          {chosen.length > 0 && !disabled && (
            <button type="button" tabIndex={-1} aria-label={`Clear ${label}`} onClick={clear} className="rounded p-0.5 text-ink-faint hover:text-ink">
              <X aria-hidden="true" className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            aria-label={`${open ? "Close" : "Open"} ${label}`}
            disabled={disabled}
            onClick={() => (open ? closeList() : (input.current?.focus(), openList()))}
            className="rounded p-0.5 text-ink-muted hover:text-ink disabled:text-ink-faint"
          >
            <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform", open && "rotate-180")} />
          </button>
        </div>
        {open && (
          <ul
            ref={list}
            id={listId}
            role="listbox"
            aria-label={label}
            aria-multiselectable={props.multiple || undefined}
            className="absolute top-full z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-line bg-surface py-1 shadow-dropdown"
          >
            {loading ? (
              <li className="px-3 py-2 text-xs text-ink-faint">Loading…</li>
            ) : shown.length === 0 ? (
              <li className="px-3 py-2 text-xs text-ink-faint">{emptyText}</li>
            ) : (
              shown.map((option, index) => {
                const selected = chosen.includes(option.value);
                return (
                  <li
                    key={option.value}
                    id={`${id}-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={selected}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => pick(option)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[12px] text-ink",
                      index === active && "bg-hover",
                      selected && !props.multiple && "font-medium text-accent-strong",
                    )}
                  >
                    {props.multiple && <input type="checkbox" tabIndex={-1} readOnly checked={selected} aria-hidden="true" className="size-3.5 accent-(--accent-strong)" />}
                    <span className="min-w-0 truncate">{option.label}</span>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>
      {error ? (
        <p id={messageId} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-xs text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
