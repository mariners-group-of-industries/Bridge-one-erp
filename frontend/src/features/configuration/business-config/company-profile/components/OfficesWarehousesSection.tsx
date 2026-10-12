"use client";

import { Building2, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { officeApi, warehouseApi } from "../services/company-profile.api";
import type { BusinessUnitDto, OfficeDto } from "../types";
import { OfficeQuickEntry } from "./OfficeQuickEntry";
import { InfoRow } from "./ProfilePanel";
import { WarehouseTable } from "./WarehouseTable";

interface Props {
  units: BusinessUnitDto[];
}

export function OfficesWarehousesSection({ units }: Props) {
  if (units.length === 0) {
    return (
      <EmptyState icon={<Building2 />} title="No business units yet">
        Add a business unit first to manage its offices and warehouses.
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {units.map((unit) => (
        <OfficeAccordion key={unit.id} unit={unit} showLabel={units.length > 1} />
      ))}
    </div>
  );
}

function OfficeAccordion({ unit, showLabel }: { unit: BusinessUnitDto; showLabel: boolean }) {
  const offices = useResource(`offices:${unit.id}`, () => officeApi.list(unit.id));
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<OfficeDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const toast = useToast();

  async function confirmDelete() {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    try {
      await officeApi.remove(deleting.id);
      offices.mutate((list = []) => list.filter((o) => o.id !== deleting.id));
      toast.success(`"${deleting.name}" deleted.`);
      setDeleting(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  }

  if (offices.error) return <ErrorState message={offices.error.message} onRetry={offices.reload} />;
  if (!offices.data) return <LoadingState />;

  return (
    <div className="flex flex-col gap-2">
      {showLabel && (
        <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-accent-strong uppercase dark:text-accent">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
          {unit.name}
        </p>
      )}

      <div className="flex justify-end">
        <Button size="sm" variant="accent-soft" onClick={() => setAdding(true)}>
          <Plus /> Add Office
        </Button>
      </div>

      {offices.data.length === 0 ? (
        <EmptyState icon={<Building2 />} title="No offices yet">
          No offices have been added to this business unit.
        </EmptyState>
      ) : (
        <div className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {offices.data.map((office) => (
            <OfficeRow
              key={office.id}
              office={office}
              open={openId === office.id}
              onToggle={() => setOpenId((prev) => (prev === office.id ? null : office.id))}
              onDelete={() => setDeleting(office)}
            />
          ))}
        </div>
      )}

      {adding && (
        <OfficeQuickEntry
          businessUnitId={unit.id}
          onClose={() => setAdding(false)}
          onCreated={(office) => {
            setAdding(false);
            offices.mutate((list = []) => [...list, office]);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete office?"
        busy={deleteBusy}
        message={
          <>
            <p>“{deleting?.name}” and all its warehouses will be permanently deleted.</p>
          </>
        }
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function OfficeRow({
  office,
  open,
  onToggle,
  onDelete,
}: {
  office: OfficeDto;
  open: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const warehouses = useResource(open ? `warehouses:${office.id}` : null, () =>
    warehouseApi.list(office.id),
  );

  return (
    <div className={cn(open && "bg-accent-soft/40")}>
      <div className="flex items-center">
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="flex flex-1 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent-soft/60 focus-visible:outline-2"
        >
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-strong dark:text-accent"
          >
            <Building2 className="size-3.5" />
          </span>
          <span className="flex-1 text-sm font-medium text-ink">{office.name}</span>
          <ChevronRight
            aria-hidden="true"
            className={cn("size-4 shrink-0 text-ink-faint transition-transform", open && "rotate-90 text-accent")}
          />
        </button>
        <button
          type="button"
          aria-label={`Delete ${office.name}`}
          onClick={onDelete}
          className="mr-2 flex size-8 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-control hover:text-danger focus-visible:outline-2"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {open && (
        <div className="border-t border-accent-line bg-surface px-4 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InfoRow label="Office Address" value={office.address} />
            <InfoRow label="Office Email" value={office.email ?? "N/A"} />
            <InfoRow label="Office Phone" value={office.phone ?? "N/A"} />
            <InfoRow label="BIN Number" value={office.binNumber ?? "N/A"} />
          </div>

          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold tracking-wide text-accent-strong uppercase dark:text-accent">
              Warehouse List
            </p>
            {!warehouses.data ? (
              <LoadingState />
            ) : (
              <WarehouseTable
                officeId={office.id}
                onCountChange={() => {}}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
