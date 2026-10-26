"use client";

import { Building2, Calendar, Check, ChevronDown, Mail, MapPin, Phone, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { DATE_FORMAT_LABELS, DATE_FORMATS, type DateFormat } from "../schemas/business-unit.schema";
import { businessUnitApi } from "../services/company-profile.api";
import type { BusinessUnitDto, CompanyDto } from "../types";
import { BusinessUnitQuickEntry } from "./BusinessUnitQuickEntry";
import { InfoRow } from "./ProfilePanel";

interface Props {
  company: CompanyDto;
  units: BusinessUnitDto[] | null;
  loading: boolean;
  error?: string;
  onReload: () => void;
  onUnitsChange: (units: BusinessUnitDto[]) => void;
}

function Detail({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span aria-hidden="true" className="mt-0.5 text-accent [&_svg]:size-3.5">
        {icon}
      </span>
      <InfoRow label={label} value={value} />
    </div>
  );
}

function formatDate(fmt: DateFormat): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = String(now.getFullYear());
  switch (fmt) {
    case "DD_MM_YYYY_SLASH": return `${dd}/${mm}/${yyyy}`;
    case "MM_DD_YYYY_SLASH": return `${mm}/${dd}/${yyyy}`;
    case "YYYY_MM_DD_DASH":  return `${yyyy}-${mm}-${dd}`;
    case "DD_MM_YYYY_DASH":  return `${dd}-${mm}-${yyyy}`;
  }
}

function DateFormatPicker({
  unit,
  onUpdated,
}: {
  unit: BusinessUnitDto;
  onUpdated: (updated: BusinessUnitDto) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function select(fmt: DateFormat) {
    if (fmt === unit.dateFormat || saving) return;
    setSaving(true);
    setOpen(false);
    try {
      const saved = await businessUnitApi.update(unit.id, {
        name: unit.name,
        address: unit.address,
        contactNumber: unit.contactNumber,
        email: unit.email,
        dateFormat: fmt,
      });
      onUpdated(saved);
    } catch (err) {
      // bubble up handled by parent toast
    } finally {
      setSaving(false);
    }
  }

  // close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative flex items-start gap-2.5">
      <span aria-hidden="true" className="mt-0.5 text-accent [&_svg]:size-3.5">
        <Calendar />
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-ink-faint">Date Format</span>
        <button
          type="button"
          disabled={saving}
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 text-sm text-ink hover:text-accent-strong focus-visible:outline-2 disabled:opacity-50"
        >
          <span>{DATE_FORMAT_LABELS[unit.dateFormat]}</span>
          <ChevronDown className={cn("size-3 text-ink-faint transition-transform", open && "rotate-180")} />
        </button>
        <span className="text-xs text-ink-faint">{formatDate(unit.dateFormat)}</span>
      </div>
      {open && (
        <div className="absolute top-full left-0 z-20 mt-1 min-w-40 rounded border border-accent-line bg-surface shadow-dropdown">
          {DATE_FORMATS.map((fmt) => (
            <button
              key={fmt}
              type="button"
              onClick={() => void select(fmt)}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent-soft",
                fmt === unit.dateFormat ? "font-medium text-accent-strong" : "text-ink",
              )}
            >
              <Check className={cn("size-3.5 shrink-0", fmt === unit.dateFormat ? "text-accent-strong" : "invisible")} />
              <span className="flex flex-col">
                <span>{DATE_FORMAT_LABELS[fmt]}</span>
                <span className="text-xs text-ink-faint">{formatDate(fmt)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function BusinessUnitListSection({ company: _company, units, loading, error, onReload, onUnitsChange }: Props) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<{ unit: BusinessUnitDto } | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (!deleting || busy) return;
    setBusy(true);
    try {
      await businessUnitApi.remove(deleting.unit.id);
      toast.success(`Deleted "${deleting.unit.name}".`);
      onUnitsChange((units ?? []).filter((u) => u.id !== deleting.unit.id));
      setDeleting(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorState message={error} onRetry={onReload} />;
  if (loading || units === null) return <LoadingState />;

  if (units.length === 0) {
    return (
      <>
        <div className="flex justify-end">
          <Button variant="accent-soft" size="sm" onClick={() => setAdding(true)}>
            <Plus /> Add Business Unit
          </Button>
        </div>
        <EmptyState icon={<Building2 />} title="No business units yet">
          Each business unit has its own offices, warehouses and document terms.
        </EmptyState>
        {adding && (
          <BusinessUnitQuickEntry
            onClose={() => setAdding(false)}
            onCreated={(unit) => { setAdding(false); onUnitsChange([unit]); }}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="flex justify-end">
        <Button variant="accent-soft" size="sm" onClick={() => setAdding(true)}>
          <Plus /> Add Business Unit
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {units.map((unit) => (
          <div
            key={unit.id}
            className="rounded border border-line border-l-[3px] border-l-accent bg-surface p-4 transition-colors hover:border-accent-line hover:border-l-accent"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <Building2 aria-hidden="true" className="size-4 shrink-0 text-accent" />
                <span className="truncate text-sm font-semibold text-ink">{unit.name}</span>
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="hover:text-danger"
                aria-label={`Delete ${unit.name}`}
                onClick={() => setDeleting({ unit })}
              >
                <Trash2 />
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Detail icon={<Phone />} label="Contact" value={unit.contactNumber} />
              <Detail icon={<Mail />} label="Email" value={unit.email} />
              <DateFormatPicker unit={unit} onUpdated={(updated) => onUnitsChange((units ?? []).map((u) => (u.id === updated.id ? updated : u)))} />
              <div className="sm:col-span-2">
                <Detail icon={<MapPin />} label="Address" value={unit.address} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {adding && (
        <BusinessUnitQuickEntry
          onClose={() => setAdding(false)}
          onCreated={(unit) => { setAdding(false); onUnitsChange([...(units ?? []), unit]); }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete business unit?"
        busy={busy}
        message={
          <>
            <p>“{deleting?.unit.name}” and all its terms will be permanently deleted.</p>
            <p className="mt-2">Business units that still have offices cannot be deleted.</p>
          </>
        }
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
