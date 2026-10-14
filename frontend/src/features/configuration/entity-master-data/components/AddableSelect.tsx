"use client";

import { Check, Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api/client";
import { Field, Input, Select } from "../employee/components/kit";

interface AddableSelectProps {
  label: string;
  required?: boolean;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  /** Saves a new option and returns its value, which is then selected. */
  onAdd: (name: string, extra: string) => Promise<string>;
  /** Optional second input when adding (e.g. a tax bracket's rate). */
  extra?: { placeholder: string; inputMode?: "decimal" };
  /** Why the field is disabled (e.g. "Select an office first"). */
  disabledReason?: string;
  error?: string;
  placeholder?: string;
}

/** Dropdown with a "+" button that adds a new option inline, saved through the API. */
export function AddableSelect({
  label,
  required,
  value,
  options,
  onChange,
  onAdd,
  extra,
  disabledReason,
  error,
  placeholder = "Select…",
}: AddableSelectProps) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [extraValue, setExtraValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState<string>();

  const cancel = () => {
    setAdding(false);
    setName("");
    setExtraValue("");
    setAddError(undefined);
  };

  const confirm = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setAddError("Enter a name.");
      return;
    }
    setSaving(true);
    try {
      const created = await onAdd(trimmed, extraValue.trim());
      onChange(created);
      cancel();
    } catch (err) {
      setAddError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const disabled = !!disabledReason;

  return (
    <Field label={label} required={required} error={addError ?? error} hint={disabled ? disabledReason : undefined}>
      {(id) =>
        adding ? (
          <div className="flex gap-1.5">
            <Input
              id={id}
              autoFocus
              value={name}
              maxLength={100}
              placeholder={`New ${label.toLowerCase()}`}
              aria-invalid={!!addError || undefined}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void confirm();
                }
                if (event.key === "Escape") cancel();
              }}
            />
            {extra && (
              <Input
                aria-label={extra.placeholder}
                value={extraValue}
                inputMode={extra.inputMode}
                placeholder={extra.placeholder}
                className="w-20 shrink-0"
                onChange={(event) => setExtraValue(event.target.value)}
              />
            )}
            <Button variant="accent" size="icon" className="size-8" loading={saving} aria-label={`Save ${label}`} onClick={confirm}>
              {!saving && <Check />}
            </Button>
            <Button size="icon" className="size-8" aria-label="Cancel" onClick={cancel} disabled={saving}>
              <X />
            </Button>
          </div>
        ) : (
          <div className="flex gap-1.5">
            <Select
              id={id}
              value={value}
              disabled={disabled}
              placeholder={placeholder}
              options={options}
              aria-invalid={!!error || undefined}
              onChange={(event) => onChange(event.target.value)}
            />
            <Button
              size="icon"
              className="size-8"
              disabled={disabled}
              aria-label={`Add new ${label.toLowerCase()}`}
              title={`Add new ${label.toLowerCase()}`}
              onClick={() => setAdding(true)}
            >
              <Plus />
            </Button>
          </div>
        )
      }
    </Field>
  );
}
