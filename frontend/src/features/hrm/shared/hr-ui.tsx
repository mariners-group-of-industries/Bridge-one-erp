"use client";

import { Eye } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useResource } from "@/hooks/use-resource";
import { apiRequest } from "@/lib/api/client";
import { Select } from "@/features/configuration/entity-master-data/employee/components/kit";
import type { HrOptions } from "./hr-access";

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const thisYear = new Date().getFullYear();
export const YEARS = Array.from({ length: 7 }, (_, i) => String(thisYear + 1 - i));

export const formatMoney = (value: number) => value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatDate = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
/** "2026-10" → "October 2026" */
export const monthLabel = (month: string) => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
/** The current month and year as select values. */
export const currentPeriod = () => ({ month: String(new Date().getMonth() + 1).padStart(2, "0"), year: String(new Date().getFullYear()) });

export function useHrOptions() {
  return useResource("hrm-options", () => apiRequest<HrOptions>("/api/hrm/options"));
}

export function OfficeSelect({
  id,
  options,
  value,
  onChange,
  allLabel = "All offices",
}: {
  id: string;
  options?: HrOptions;
  value: string;
  onChange: (value: string) => void;
  allLabel?: string | false;
}) {
  return (
    <Select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={allLabel}
      options={(options?.offices ?? []).map((o) => ({ value: o.id, label: `${o.name} (${o.businessUnit})` }))}
    />
  );
}

export function MonthSelect({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  return <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={false} options={MONTHS.map((label, i) => ({ value: String(i + 1).padStart(2, "0"), label }))} />;
}

export function YearSelect({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  return <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={false} options={YEARS} />;
}

/** Filter fields in a row with the View (or Apply) button at the end. */
export function FilterBar({ onSubmit, children, buttonLabel = "View", busy }: { onSubmit: () => void; children: ReactNode; buttonLabel?: string; busy?: boolean }) {
  return (
    <form
      role="search"
      className="flex flex-wrap items-end gap-3 rounded border border-line bg-surface px-4 py-3 shadow-xs"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {children}
      <Button type="submit" variant="primary" loading={busy}>
        <Eye aria-hidden="true" className="size-3.5" />
        {buttonLabel}
      </Button>
    </form>
  );
}

/** A labelled control inside a FilterBar. */
export function FilterField({ label, width = "w-44", children }: { label: string; width?: string; children: (id: string) => ReactNode }) {
  const id = `hr-filter-${label.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <div className={`flex flex-col gap-1 ${width}`}>
      <label htmlFor={id} className="text-xs font-medium text-ink-muted">
        {label}
      </label>
      {children(id)}
    </div>
  );
}
