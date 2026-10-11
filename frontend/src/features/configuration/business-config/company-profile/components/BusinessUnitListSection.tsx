"use client";

import { Building2, Calendar, Mail, MapPin, Phone, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import { DATE_FORMAT_LABELS } from "../schemas/business-unit.schema";
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

function formatDateExample(format: BusinessUnitDto["dateFormat"]): string {
  const label = DATE_FORMAT_LABELS[format];
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = String(now.getFullYear());
  switch (format) {
    case "DD_MM_YYYY_SLASH": return `${dd}/${mm}/${yyyy}`;
    case "MM_DD_YYYY_SLASH": return `${mm}/${dd}/${yyyy}`;
    case "YYYY_MM_DD_DASH":  return `${yyyy}-${mm}-${dd}`;
    case "DD_MM_YYYY_DASH":  return `${dd}-${mm}-${yyyy}`;
    default: return label;
  }
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

export function BusinessUnitListSection({ company, units, loading, error, onReload, onUnitsChange }: Props) {
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
            className="rounded-lg border border-line border-l-[3px] border-l-accent bg-surface p-4 transition-colors hover:border-accent-line hover:border-l-accent"
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
              <Detail
                icon={<Calendar />}
                label="Date Format"
                value={`${DATE_FORMAT_LABELS[unit.dateFormat]} — ${formatDateExample(unit.dateFormat)}`}
              />
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
