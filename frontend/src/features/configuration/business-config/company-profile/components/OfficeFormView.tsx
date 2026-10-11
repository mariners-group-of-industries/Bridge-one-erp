"use client";

import { Ellipsis, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { RecordMeta } from "@/components/layout/record-meta";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Indicator } from "@/components/ui/indicator";
import { Card, EmptyState, ErrorState, FieldGrid, LoadingState, Section } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { useSaveShortcut } from "@/hooks/use-save-shortcut";
import { useValidatedForm } from "@/hooks/use-validated-form";
import { ApiClientError, errorMessage } from "@/lib/api/client";
import { paths } from "../paths";
import { OFFICE_ASSET_KINDS, officeInputSchema } from "../schemas/office.schema";
import { businessUnitApi, officeApi } from "../services/company-profile.api";
import type { OfficeDto } from "../types";
import { OfficeAssetUpload } from "./OfficeAssetUpload";
import { OfficeFields, officeValues } from "./OfficeFields";
import { WarehouseTable } from "./WarehouseTable";

type TabId = "details" | "branding" | "warehouses";

/** ERPNext form view for one office. */
export function OfficeFormView({ officeId }: { officeId: string }) {
  const office = useResource(`office:${officeId}`, () => officeApi.get(officeId));

  if (office.error || !office.data) {
    const notFound = office.error instanceof ApiClientError && office.error.status === 404;
    return (
      <PageContainer>
        <PageHead title="Office" />
        <Card>
          {notFound ? (
            <EmptyState title="Office not found">
              <p className="mb-3">It may have been deleted.</p>
              <Link href={paths.businessUnits} className={buttonClasses("primary")}>
                Back to Business Units
              </Link>
            </EmptyState>
          ) : office.error ? (
            <ErrorState message={office.error.message} onRetry={office.reload} />
          ) : (
            <LoadingState />
          )}
        </Card>
      </PageContainer>
    );
  }

  return <OfficeForm key={office.data.id} office={office.data} onChange={(next) => office.mutate(() => next)} />;
}

function OfficeForm({ office, onChange }: { office: OfficeDto; onChange: (office: OfficeDto) => void }) {
  const router = useRouter();
  const toast = useToast();
  const units = useResource("business-units", businessUnitApi.list);
  const unitName = units.data?.find((unit) => unit.id === office.businessUnitId)?.name;
  const [tab, setTab] = useState<TabId>("details");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const inFlight = useRef(false);
  const form = useValidatedForm(officeInputSchema, officeValues(office));

  async function save() {
    if (inFlight.current || !form.dirty) return;
    const input = form.validate();
    if (!input) {
      setTab("details");
      return;
    }
    inFlight.current = true;
    setSaving(true);
    try {
      const saved = await officeApi.update(office.id, input);
      form.reset(officeValues(saved));
      onChange(saved);
      toast.success("Saved.");
    } catch (error) {
      if (form.applyServerError(error)) setTab("details");
      else toast.error(errorMessage(error));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  /** Discards unsaved changes and loads the latest saved values. */
  async function reload() {
    try {
      const fresh = await officeApi.get(office.id);
      form.reset(officeValues(fresh));
      onChange(fresh);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await officeApi.remove(office.id);
      toast.success(`Office "${office.name}" deleted.`);
      router.push(paths.businessUnit(office.businessUnitId));
    } catch (error) {
      toast.error(errorMessage(error));
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  useSaveShortcut(() => void save(), form.dirty);

  const assets = new Map(office.assets.map((asset) => [asset.kind, asset]));
  const tabs = [
    { id: "details", label: "Details" },
    { id: "branding", label: "Branding", badge: `${office.assets.length}/${OFFICE_ASSET_KINDS.length}` },
    { id: "warehouses", label: "Warehouses", badge: office.warehouseCount },
  ] as const;

  return (
    <PageContainer>
      <PageHead
        title={office.name}
        subtitle={
          <>
            Office of{" "}
            <Link href={paths.businessUnit(office.businessUnitId)} className="text-ink-muted hover:text-ink hover:underline">
              {unitName ?? "business unit"}
            </Link>
          </>
        }
        indicator={form.dirty && <Indicator color="orange">Not Saved</Indicator>}
        actions={
          <>
            <DropdownMenu
              items={[
                { label: "Reload", icon: <RefreshCw />, onSelect: () => void reload() },
                "separator",
                { label: "Delete", icon: <Trash2 />, danger: true, onSelect: () => setConfirmDelete(true) },
              ]}
              trigger={<Ellipsis />}
              triggerLabel="More actions"
              triggerClassName={buttonClasses("secondary", "icon", "size-8")}
            />
            <Button variant="primary" loading={saving} disabled={!form.dirty} onClick={save}>
              Save
            </Button>
          </>
        }
      />
      <Card>
        <Tabs tabs={tabs} value={tab} onChange={setTab} label="Office sections">
          {tab === "details" && (
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <Section title="Office Details">
                <FieldGrid>
                  <OfficeFields form={form} />
                </FieldGrid>
              </Section>
              <button type="submit" hidden />
            </form>
          )}
          {tab === "branding" && (
            <Section title="Branding" description="Printed on documents issued by this office. Saved immediately on upload.">
              <div className="grid gap-4 sm:grid-cols-3">
                {OFFICE_ASSET_KINDS.map((kind) => (
                  <OfficeAssetUpload
                    key={kind}
                    officeId={office.id}
                    kind={kind}
                    asset={assets.get(kind)}
                    onChange={(changedKind, asset) =>
                      onChange({
                        ...office,
                        assets: [...office.assets.filter((item) => item.kind !== changedKind), ...(asset ? [asset] : [])],
                      })
                    }
                  />
                ))}
              </div>
            </Section>
          )}
          {tab === "warehouses" && (
            <Section title="Warehouses" description="Stock locations of this office. Changes are saved immediately.">
              <WarehouseTable
                officeId={office.id}
                onCountChange={(count) => onChange({ ...office, warehouseCount: count })}
              />
            </Section>
          )}
        </Tabs>
      </Card>
      <RecordMeta updatedAt={office.updatedAt} />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete office?"
        busy={deleting}
        message={
          <>
            <p>
              <strong>{office.name}</strong> and its branding files will be permanently deleted.
            </p>
            {office.warehouseCount > 0 && (
              <p className="mt-2 text-danger">
                This office still has {office.warehouseCount} warehouse(s). Remove them first.
              </p>
            )}
          </>
        }
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      />
    </PageContainer>
  );
}
