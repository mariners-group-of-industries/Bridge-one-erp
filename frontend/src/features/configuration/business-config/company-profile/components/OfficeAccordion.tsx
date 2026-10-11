"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import { useResource } from "../hooks/use-resource";
import { OFFICE_ASSET_KINDS, type OfficeAssetKind } from "../schemas/office.schema";
import { officeApi } from "../services/company-profile.api";
import type { OfficeAssetDto, OfficeDto } from "../types";
import { OfficeAssetUpload } from "./OfficeAssetUpload";
import { OfficeForm } from "./OfficeForm";
import { WarehouseList } from "./WarehouseList";

interface OfficeAccordionProps {
  businessUnitId: string;
  adding: boolean;
  onAddingChange: (adding: boolean) => void;
  onOfficeCountChange: () => void;
}

export function OfficeAccordion({
  businessUnitId,
  adding,
  onAddingChange,
  onOfficeCountChange,
}: OfficeAccordionProps) {
  const toast = useToast();
  const offices = useResource(`offices:${businessUnitId}`, () => officeApi.list(businessUnitId));
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [editing, setEditing] = useState<OfficeDto | null>(null);
  const [deleting, setDeleting] = useState<OfficeDto | null>(null);
  const [busy, setBusy] = useState(false);

  function updateOffice(id: string, update: (office: OfficeDto) => OfficeDto) {
    offices.mutate((list = []) => list.map((office) => (office.id === id ? update(office) : office)));
  }

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function confirmDelete() {
    if (!deleting || busy) return;
    setBusy(true);
    try {
      await officeApi.remove(deleting.id);
      offices.mutate((list = []) => list.filter((office) => office.id !== deleting.id));
      onOfficeCountChange();
      toast.success(`Office "${deleting.name}" deleted.`);
      setDeleting(null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  let content: React.ReactNode;
  if (offices.error) {
    content = <ErrorState message={offices.error.message} onRetry={offices.reload} />;
  } else if (!offices.data) {
    content = <LoadingState label="Loading offices…" />;
  } else if (offices.data.length === 0) {
    content = (
      <EmptyState title="No offices yet">
        Add a head office, regional office or branch to this business unit.
      </EmptyState>
    );
  } else {
    content = (
      <ul className="flex flex-col gap-3">
        {offices.data.map((office) => {
          const isOpen = expanded.has(office.id);
          const panelId = `office-panel-${office.id}`;
          const assets = new Map(office.assets.map((asset) => [asset.kind, asset]));
          return (
            <li key={office.id} className="overflow-hidden rounded-md border border-zinc-200">
              <h3>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggle(office.id)}
                  className="flex w-full items-center gap-3 bg-zinc-50 px-4 py-3 text-left hover:bg-zinc-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className={`size-4 shrink-0 text-zinc-500 transition-transform ${isOpen ? "rotate-90" : ""}`}
                  >
                    <path d="M7 5l6 5-6 5" fill="none" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  <span aria-hidden="true" className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-blue-800">
                    Office
                  </span>
                  <span className="flex-1 font-medium text-zinc-900">{office.name}</span>
                  <span className="text-xs text-zinc-500">
                    {office.warehouseCount} warehouse{office.warehouseCount === 1 ? "" : "s"}
                  </span>
                </button>
              </h3>
              {isOpen && (
                <div id={panelId} className="flex flex-col gap-6 border-t border-zinc-200 px-4 py-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <dl className="grid flex-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                      <Detail label="Address" value={office.address} wide />
                      <Detail label="Email" value={office.email} />
                      <Detail label="Phone" value={office.phone} />
                      <Detail label="BIN number" value={office.binNumber} />
                    </dl>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setEditing(office)}>
                        Edit office
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-700" onClick={() => setDeleting(office)}>
                        Delete office
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <h4 className="text-sm font-semibold text-zinc-900">Branding</h4>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {OFFICE_ASSET_KINDS.map((kind) => (
                        <OfficeAssetUpload
                          key={kind}
                          officeId={office.id}
                          kind={kind}
                          asset={assets.get(kind)}
                          onChange={(changedKind: OfficeAssetKind, asset: OfficeAssetDto | null) =>
                            updateOffice(office.id, (current) => ({
                              ...current,
                              assets: [
                                ...current.assets.filter((item) => item.kind !== changedKind),
                                ...(asset ? [asset] : []),
                              ],
                            }))
                          }
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 rounded-md bg-amber-50/40 p-3 ring-1 ring-amber-100">
                    <h4 className="text-sm font-semibold text-zinc-900">Warehouses</h4>
                    <WarehouseList
                      officeId={office.id}
                      officeName={office.name}
                      onCountChange={(count) =>
                        updateOffice(office.id, (current) => ({ ...current, warehouseCount: count }))
                      }
                    />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <>
      {content}

      {(adding || editing) && (
        <OfficeForm
          businessUnitId={businessUnitId}
          office={editing ?? undefined}
          onClose={() => {
            setEditing(null);
            onAddingChange(false);
          }}
          onSaved={(saved) => {
            if (editing) {
              updateOffice(saved.id, () => saved);
            } else {
              offices.mutate((list = []) => [...list, saved]);
              setExpanded((current) => new Set(current).add(saved.id));
              onOfficeCountChange();
            }
            setEditing(null);
            onAddingChange(false);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete office?"
        busy={busy}
        message={
          deleting && (
            <>
              <p>
                <strong>{deleting.name}</strong> and its branding files will be permanently deleted.
              </p>
              {deleting.warehouseCount > 0 && (
                <p className="mt-2 text-red-700">
                  This office still has {deleting.warehouseCount} warehouse(s). Remove them first.
                </p>
              )}
            </>
          )
        }
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}

function Detail({ label, value, wide }: { label: string; value: string | null; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="whitespace-pre-line text-zinc-800">{value || "—"}</dd>
    </div>
  );
}
