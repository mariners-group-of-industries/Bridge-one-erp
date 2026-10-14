"use client";

import { Building2, Calendar, Mail, MapPin, Phone, Plus, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { paths } from "../paths";
import { DATE_FORMAT_LABELS, DATE_FORMATS, type DateFormat } from "../schemas/business-unit.schema";
import { businessUnitApi, companyApi } from "../services/company-profile.api";
import type { BusinessUnitDto } from "../types";
import { BusinessUnitQuickEntry } from "./BusinessUnitQuickEntry";

// ─── helpers ────────────────────────────────────────────────────────────────

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

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-accent [&_svg]:size-3.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-ink-faint">{label}</p>
        <p className="truncate text-sm text-ink">{value}</p>
      </div>
    </div>
  );
}

function DateFormatBadge({
  unit,
  onUpdated,
}: {
  unit: BusinessUnitDto;
  onUpdated: (u: BusinessUnitDto) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

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
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-accent [&_svg]:size-3.5"><Calendar /></span>
      <div className="min-w-0">
        <p className="text-xs text-ink-faint">Date Format</p>
        <button
          type="button"
          disabled={saving}
          onClick={() => setOpen((v) => !v)}
          className="text-sm text-ink hover:text-accent-strong focus-visible:outline-2 disabled:opacity-50"
        >
          {DATE_FORMAT_LABELS[unit.dateFormat]}
          <span className="ml-1 text-xs text-ink-faint">({formatDate(unit.dateFormat)})</span>
        </button>
      </div>
      {open && (
        <div className="absolute top-full left-0 z-20 mt-1 min-w-44 rounded border border-accent-line bg-surface shadow-dropdown">
          {DATE_FORMATS.map((fmt) => (
            <button
              key={fmt}
              type="button"
              onClick={() => void select(fmt)}
              className={cn(
                "flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-accent-soft",
                fmt === unit.dateFormat ? "font-medium text-accent-strong" : "text-ink",
              )}
            >
              <span>{DATE_FORMAT_LABELS[fmt]}</span>
              <span className="text-xs text-ink-faint">{formatDate(fmt)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── unit card ──────────────────────────────────────────────────────────────

function UnitCard({
  unit,
  onDelete,
  onUpdated,
}: {
  unit: BusinessUnitDto;
  onDelete: (unit: BusinessUnitDto) => void;
  onUpdated: (unit: BusinessUnitDto) => void;
}) {
  return (
    <div className="group relative flex flex-col rounded border border-line bg-surface transition-shadow hover:shadow-dropdown">
      {/* accent top bar */}
      <div className="h-1 w-full rounded-t bg-accent" />

      {/* header */}
      <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-3">
        <Link
          href={paths.businessUnit(unit.id)}
          className="flex min-w-0 items-center gap-2.5 hover:underline"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded bg-accent-soft text-accent">
            <Building2 className="size-4" />
          </span>
          <span className="truncate text-base font-semibold text-ink">{unit.name}</span>
        </Link>
        <Button
          size="icon"
          variant="ghost"
          className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger"
          aria-label={`Delete ${unit.name}`}
          onClick={() => onDelete(unit)}
        >
          <Trash2 />
        </Button>
      </div>

      {/* divider */}
      <div className="mx-5 border-t border-line" />

      {/* details grid */}
      <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
        <Detail icon={<Phone />} label="Contact" value={unit.contactNumber} />
        <Detail icon={<Mail />} label="Email" value={unit.email} />
        <DateFormatBadge unit={unit} onUpdated={onUpdated} />
        <div className="sm:col-span-2">
          <Detail icon={<MapPin />} label="Address" value={unit.address} />
        </div>
      </div>

      {/* footer */}
      <div className="mt-auto flex items-center justify-between border-t border-line px-5 py-2.5">
        <span className="text-xs text-ink-faint">
          {unit.officeCount} {unit.officeCount === 1 ? "office" : "offices"}
        </span>
        <Link
          href={paths.businessUnit(unit.id)}
          className="text-xs font-medium text-accent hover:text-accent-strong hover:underline"
        >
          View details →
        </Link>
      </div>
    </div>
  );
}

// ─── main view ──────────────────────────────────────────────────────────────

export function BusinessUnitListView() {
  const router = useRouter();
  const toast = useToast();
  const company = useResource("company", companyApi.get);
  const units = useResource(
    company.data ? `business-units:${company.data.id}` : null,
    businessUnitApi.list,
  );
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<BusinessUnitDto | null>(null);
  const [busy, setBusy] = useState(false);

  function handleUpdated(updated: BusinessUnitDto) {
    units.mutate((prev) => (prev ?? []).map((u) => (u.id === updated.id ? updated : u)));
  }

  async function confirmDelete() {
    if (!deleting || busy) return;
    setBusy(true);
    try {
      await businessUnitApi.remove(deleting.id);
      toast.success(`Deleted "${deleting.name}".`);
      units.reload();
      setDeleting(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  let body: React.ReactNode;

  if (company.error) {
    body = <ErrorState message={company.error.message} onRetry={company.reload} />;
  } else if (company.data === undefined) {
    body = <LoadingState />;
  } else if (company.data === null) {
    body = (
      <div className="rounded border border-line bg-surface p-10">
        <EmptyState icon={<Building2 />} title="Set up your company first">
          <p className="mb-3">Business units are created under the company profile.</p>
          <Link href={paths.companyProfile} className={buttonClasses("primary")}>
            Set up company profile
          </Link>
        </EmptyState>
      </div>
    );
  } else if (units.error) {
    body = <ErrorState message={units.error.message} onRetry={units.reload} />;
  } else if (!units.data) {
    body = <LoadingState />;
  } else if (units.data.length === 0) {
    body = (
      <div className="rounded border border-line bg-surface p-10">
        <EmptyState icon={<Building2 />} title="No business units yet">
          <p className="mb-3">Each business unit has its own offices, warehouses and document terms.</p>
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Plus /> Add Business Unit
          </Button>
        </EmptyState>
      </div>
    );
  } else {
    body = (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {units.data.map((unit) => (
          <UnitCard
            key={unit.id}
            unit={unit}
            onDelete={setDeleting}
            onUpdated={handleUpdated}
          />
        ))}
      </div>
    );
  }

  return (
    <PageContainer full>
      <PageHead
        title="Business Units"
        subtitle={company.data ? company.data.name : undefined}
        actions={
          company.data && (
            <>
              <Button size="icon" aria-label="Reload" onClick={units.reload}>
                <RefreshCw />
              </Button>
              <Button variant="primary" onClick={() => setAdding(true)}>
                <Plus /> Add Business Unit
              </Button>
            </>
          )
        }
      />

      {body}

      {adding && (
        <BusinessUnitQuickEntry
          onClose={() => setAdding(false)}
          onCreated={(unit) => {
            setAdding(false);
            router.push(paths.businessUnit(unit.id));
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete business unit?"
        busy={busy}
        message={
          <>
            <p>&quot;{deleting?.name}&quot; and all its terms will be permanently deleted.</p>
            <p className="mt-2">Business units that still have offices cannot be deleted.</p>
          </>
        }
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </PageContainer>
  );
}
